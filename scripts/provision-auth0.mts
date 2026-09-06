#!/usr/bin/env node
/**
 * Brings an Auth0 tenant to the state the live e2e specs expect, then writes the
 * matching values into .env.e2e.local.
 *
 *   AUTH0_DOMAIN=your-tenant.eu.auth0.com \
 *   AUTH0_MGMT_TOKEN_FILE=/path/to/token \
 *   pnpm provision:auth0 [--dry-run]
 *
 * Why this exists: every Auth0 problem this suite has hit was a configuration
 * mistake, not a code one — a credential added but never assigned, a Require PAR
 * toggle left on, an application missing from an API's authorized list, a grant
 * with the wrong subject type. Each of those is one line below, and none of them
 * can drift again.
 *
 * It is idempotent. Run it against a brand new tenant to build everything, or
 * against a configured one to converge it. It only creates and patches — it never
 * deletes, so anything it does not know about is left alone.
 *
 * Needs a Management API token with read/create/update on clients,
 * client_credentials, client_grants, connections, resource_servers, users and
 * tenant_settings. Dashboard -> Applications -> APIs -> Auth0 Management API ->
 * API Explorer gives one that covers all of it.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { calculateJwkThumbprint, exportJWK, importSPKI } from "jose";

// --- what the live specs need -----------------------------------------------

const REDIRECT_URI =
  process.env.E2E_REDIRECT_URI || "https://localhost:3000/callback/auth-code";
const API_IDENTIFIER =
  process.env.E2E_AUTH0_API_IDENTIFIER || "https://localhost/orders";
const API_SCOPE = "read:orders";
const RAR_TYPE = "payment_initiation";
const CONNECTION =
  process.env.E2E_AUTH0_CONNECTION || "Username-Password-Authentication";
const USER_EMAIL =
  process.env.E2E_AUTH0_TEST_USER || "e2e-user@demo-tenant.example";

const PRIVATE_KEY_PATH = "certificates/auth0-e2e-private.pem";
const ENV_PATH = ".env.e2e.local";

/**
 * Four applications, because Auth0 forces the split: the token-endpoint
 * authentication method is exclusive per application, so an application switched
 * to Private Key JWT loses the client secret the other specs authenticate with.
 *
 * One Private Key JWT application is enough for three specs, though — client
 * credentials, confidential authorization code, and PAR/JAR — as long as it holds
 * both kinds of client grant. That is what the `grants` field below encodes.
 */
const APPS = {
  spa: {
    name: "OAuth Playground E2E — SPA",
    app_type: "spa",
    grant_types: ["authorization_code", "implicit", "refresh_token"],
    token_endpoint_auth_method: "none",
    callbacks: [REDIRECT_URI],
    grants: ["user"] as SubjectType[],
  },
  web: {
    name: "OAuth Playground E2E — Web (secret)",
    app_type: "regular_web",
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "client_secret_post",
    callbacks: [REDIRECT_URI],
    grants: ["user"] as SubjectType[],
  },
  m2m: {
    name: "OAuth Playground E2E — M2M (secret)",
    app_type: "non_interactive",
    grant_types: ["client_credentials"],
    token_endpoint_auth_method: "client_secret_post",
    callbacks: [],
    grants: ["client"] as SubjectType[],
  },
  pkjwt: {
    name: "OAuth Playground E2E — Web (private_key_jwt)",
    app_type: "regular_web",
    grant_types: ["authorization_code", "refresh_token", "client_credentials"],
    // set through client_authentication_methods instead; see ensurePrivateKeyJwt
    token_endpoint_auth_method: "client_secret_post",
    callbacks: [REDIRECT_URI],
    // both, so one application can serve the user flows and client credentials
    grants: ["user", "client"] as SubjectType[],
  },
} as const;

type SubjectType = "user" | "client";
type AppKey = keyof typeof APPS;

// --- plumbing ---------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");

const DOMAIN = required("AUTH0_DOMAIN")
  .replace(/^https?:\/\//, "")
  .replace(/\/$/, "");
const TOKEN = readToken();

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`${name} is not set. See the header of this file.`);
  }
  return value;
}

function readToken(): string {
  const file = process.env.AUTH0_MGMT_TOKEN_FILE?.trim();
  if (file) {
    if (!existsSync(file))
      fail(`AUTH0_MGMT_TOKEN_FILE does not exist: ${file}`);
    return readFileSync(file, "utf8").trim();
  }
  return required("AUTH0_MGMT_TOKEN");
}

function fail(message: string): never {
  const sanitized = message.replace(/[\r\n]+/g, " ").trim();
  console.error(`\n  ${sanitized}\n`);
  process.exit(1);
}

const changes: string[] = [];

function note(action: "=" | "+" | "~", message: string) {
  // "=" already correct, "+" created, "~" changed
  if (action !== "=") changes.push(message);
  console.log(`  ${action} ${message}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The response body as JSON, or undefined when it is not JSON at all. An error
 * page from an intermediary must not become a parse exception that hides the
 * status it arrived with.
 */
function parseJsonBody(response: Response, text: string): any {
  if (!text) return undefined;
  if (!(response.headers.get("content-type") || "").includes("json")) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Enough of a non-JSON body to recognise it, without pasting a whole HTML page. */
function summarize(text: string): string {
  const collapsed = text.replaceAll(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed;
}

/**
 * The Management API rate-limits hard on non-production tenants, and a full
 * provisioning pass is comfortably enough calls to trip it. 429 is retried rather
 * than fatal — the alternative is a half-configured tenant, which is exactly the
 * state this script exists to prevent.
 */
async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`https://${DOMAIN}/api/v2${path}`, {
      method,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    // Status first, and only then the body. Parsing up front threw on any
    // response that was not JSON — a gateway or WAF in front of the Management
    // API answers 429 with an HTML page — so the retry below was skipped for
    // exactly the rate limits it exists to absorb, and the run died with a JSON
    // syntax error naming neither the method, the path, nor the status.
    if (response.status === 429 && attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(2 ** attempt, 16) * 1000;
      console.log(
        `    ${method} ${path} rate limited (429), retrying in ${waitMs / 1000}s`,
      );
      await sleep(waitMs);
      continue;
    }

    const payload = parseJsonBody(response, text);

    if (!response.ok) {
      const rawDetail =
        payload?.message || payload?.error_description || summarize(text);
      const detail = rawDetail.replace(/[\r\n]+/g, " ").trim();
      fail(`${method} ${path} -> HTTP ${response.status}\n  ${detail}`);
    }

    return payload as T;
  }
}

/** A write, unless this is a dry run. */
async function mutate<T = any>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T | undefined> {
  if (DRY_RUN) return undefined;
  return api<T>(method, path, body);
}

// --- steps ------------------------------------------------------------------

async function ensureTenantSettings() {
  const settings = await api("GET", "/tenants/settings");

  if (settings.pushed_authorization_requests_supported === true) {
    note("=", "tenant allows PAR");
    return;
  }

  await mutate("PATCH", "/tenants/settings", {
    pushed_authorization_requests_supported: true,
  });
  note("~", "tenant: enabled Allow PAR (needed for the PAR and JAR specs)");
}

async function ensureApi() {
  const servers = await api("GET", "/resource-servers?per_page=100");
  const existing = servers.find(
    (server: any) => server.identifier === API_IDENTIFIER,
  );

  if (!existing) {
    await mutate("POST", "/resource-servers", {
      name: "OAuth Playground E2E API",
      identifier: API_IDENTIFIER,
      signing_alg: "RS256",
      scopes: [{ value: API_SCOPE, description: "Read orders" }],
      authorization_details: [{ type: RAR_TYPE }],
    });
    note("+", `API ${API_IDENTIFIER} (with RAR type ${RAR_TYPE})`);
    return;
  }

  const hasScope = (existing.scopes || []).some(
    (scope: any) => scope.value === API_SCOPE,
  );
  const hasRarType = (existing.authorization_details || []).some(
    (item: any) => item.type === RAR_TYPE,
  );

  if (hasScope && hasRarType) {
    note("=", `API ${API_IDENTIFIER}`);
    return;
  }

  const patchBody: Record<string, unknown> = {};
  const updates: string[] = [];

  if (!hasScope) {
    patchBody.scopes = [
      ...(existing.scopes || []),
      { value: API_SCOPE, description: "Read orders" },
    ];
    updates.push(`added scope ${API_SCOPE}`);
  }

  if (!hasRarType) {
    patchBody.authorization_details = [
      ...(existing.authorization_details || []),
      { type: RAR_TYPE },
    ];
    updates.push(`added RAR type ${RAR_TYPE}`);
  }

  await mutate(
    "PATCH",
    `/resource-servers/${encodeURIComponent(existing.id)}`,
    patchBody,
  );
  note("~", `API ${API_IDENTIFIER}: ${updates.join(", ")}`);
}

type Client = { client_id: string; client_secret?: string; name: string };

// One read serves all four applications; the tenant is rate-limited enough that
// re-fetching per application is worth avoiding.
let clientCache: any[] | undefined;

async function allClients(): Promise<any[]> {
  if (!clientCache) {
    const clients = await api<any[]>(
      "GET",
      "/clients?per_page=100&fields=client_id,name,app_type,callbacks,grant_types,token_endpoint_auth_method,client_secret&include_fields=true",
    );
    // Anything other than a list here would make every ensureClient below think
    // its application is absent and create a second one. Stop instead.
    if (!Array.isArray(clients)) {
      fail("GET /clients did not return a list of applications");
    }
    clientCache = clients;
  }
  return clientCache;
}

async function ensureClient(key: AppKey): Promise<Client> {
  const spec = APPS[key];
  const clients = await allClients();
  const existing = clients.find((client: any) => client.name === spec.name);

  const desired: Record<string, unknown> = {
    app_type: spec.app_type,
    grant_types: [...spec.grant_types],
    callbacks: [...spec.callbacks],
    oidc_conformant: true,
    is_first_party: true,
    jwt_configuration: { alg: "RS256" },
  };

  if (!existing) {
    const created = await mutate<Client>("POST", "/clients", {
      name: spec.name,
      token_endpoint_auth_method: spec.token_endpoint_auth_method,
      ...desired,
    });
    if (created) clientCache?.push(created);
    note("+", `application ${spec.name}`);
    return created ?? { client_id: `<${key}>`, name: spec.name };
  }

  // Converge only what drifted. token_endpoint_auth_method is deliberately not
  // enforced here: the private_key_jwt application owns it through
  // client_authentication_methods, and sending both is rejected.
  const drift: Record<string, unknown> = {};
  if (existing.app_type !== spec.app_type) drift.app_type = spec.app_type;
  if (!sameSet(existing.grant_types, spec.grant_types))
    drift.grant_types = [...spec.grant_types];
  if (!sameSet(existing.callbacks, spec.callbacks))
    drift.callbacks = [...spec.callbacks];

  if (Object.keys(drift).length === 0) {
    note("=", `application ${spec.name}`);
  } else {
    await mutate("PATCH", `/clients/${existing.client_id}`, drift);
    note("~", `application ${spec.name}: ${Object.keys(drift).join(", ")}`);
  }

  return existing;
}

/** True for the stand-in id a dry run uses where a real run would create a client. */
function isPending(clientId: string): boolean {
  return clientId.startsWith("<");
}

function sameSet(a: unknown, b: readonly string[]): boolean {
  const left = [...((a as string[]) || [])].sort((x, y) => x.localeCompare(y));
  const right = [...b].sort((x, y) => x.localeCompare(y));
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

/**
 * Registers the signing key and — the step that is easy to miss — assigns it to
 * *both* the client authentication method and the signed request object. Adding a
 * credential does nothing on its own; an unassigned key answers every request with
 * `invalid_client`, and an unassigned request-object key with "Client has no
 * associated credentials for signed JWT".
 *
 * One credential covers both. Auth0 allows two per application, for rotation.
 */
async function ensurePrivateKeyJwt(clientId: string) {
  const { privateKeyPem, publicKeyPem } = loadOrCreateKeyPair();
  const kid = await jwkThumbprint(publicKeyPem);

  if (isPending(clientId)) {
    note("+", `credential on the private_key_jwt application (kid ${kid})`);
    note(
      "+",
      "credential assigned to client authentication and request objects",
    );
    return { privateKeyPem, kid };
  }

  const credentials = await api(
    "GET",
    `/clients/${clientId}/credentials`,
  ).catch(() => []);
  let credential = (credentials as any[]).find((c) => c.kid === kid);

  if (!credential) {
    credential = await mutate("POST", `/clients/${clientId}/credentials`, {
      credential_type: "public_key",
      name: "e2e signing key",
      alg: "RS256",
      pem: publicKeyPem,
    });
    note("+", `credential on the private_key_jwt application (kid ${kid})`);
  } else {
    note("=", `credential on the private_key_jwt application (kid ${kid})`);
  }

  const credentialId = credential?.id;
  if (!credentialId) {
    // dry run, or a tenant that refused the credential
    return { privateKeyPem, kid };
  }

  const client = await api(
    "GET",
    `/clients/${clientId}?fields=client_authentication_methods,signed_request_object,require_pushed_authorization_requests&include_fields=true`,
  );

  const assignedToAuth =
    client.client_authentication_methods?.private_key_jwt?.credentials?.[0]
      ?.id === credentialId;
  const assignedToRequestObject =
    client.signed_request_object?.credentials?.[0]?.id === credentialId;
  const requiresPar = client.require_pushed_authorization_requests === true;

  if (assignedToAuth && assignedToRequestObject && !requiresPar) {
    note(
      "=",
      "credential assigned to client authentication and request objects",
    );
    return { privateKeyPem, kid };
  }

  await mutate("PATCH", `/clients/${clientId}`, {
    // Auth0 rejects the migration unless the old field is explicitly cleared in
    // the same request: the two ways of saying how a client authenticates cannot
    // both be set.
    token_endpoint_auth_method: null,
    client_authentication_methods: {
      private_key_jwt: { credentials: [{ id: credentialId }] },
    },
    signed_request_object: {
      required: false,
      credentials: [{ id: credentialId }],
    },
    // "Require" makes a mode mandatory and breaks every spec that does not use
    // it; the app must offer PAR and JAR without demanding them.
    require_pushed_authorization_requests: false,
  });
  note(
    "~",
    "assigned the credential to client authentication and request objects",
  );

  return { privateKeyPem, kid };
}

function loadOrCreateKeyPair() {
  if (existsSync(PRIVATE_KEY_PATH)) {
    const privateKeyPem = readFileSync(PRIVATE_KEY_PATH, "utf8");
    return { privateKeyPem, publicKeyPem: publicFromPrivate(privateKeyPem) };
  }

  // A tenant configured before this script existed has its key in the env file
  // rather than on disk. Reusing it converges on the credential already
  // registered, instead of spending the second of the two slots an application
  // has on a duplicate.
  const fromEnv = readEnvValue("E2E_AUTH0_PRIVATE_KEY_PEM").replaceAll(
    String.raw`\n`,
    "\n",
  );
  if (fromEnv.includes("BEGIN")) {
    if (!DRY_RUN) {
      mkdirSync("certificates", { recursive: true });
      writeFileSync(PRIVATE_KEY_PATH, `${fromEnv.trim()}\n`, { mode: 0o600 });
    }
    note("~", `adopted the existing signing key into ${PRIVATE_KEY_PATH}`);
    return { privateKeyPem: fromEnv, publicKeyPem: publicFromPrivate(fromEnv) };
  }

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  if (DRY_RUN) {
    // A dry run writes nothing, so the kid below is this throwaway key's rather
    // than the one a real run would register.
    note("+", `signing key at ${PRIVATE_KEY_PATH} (not written — dry run)`);
  } else {
    mkdirSync("certificates", { recursive: true });
    writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    note("+", `signing key at ${PRIVATE_KEY_PATH} (gitignored, mode 600)`);
  }

  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

function publicFromPrivate(privateKeyPem: string): string {
  return createPublicKey(privateKeyPem).export({
    type: "spki",
    format: "pem",
  }) as string;
}

/** Auth0 derives the credential kid from the RFC 7638 thumbprint of the key. */
async function jwkThumbprint(publicKeyPem: string): Promise<string> {
  const key = await importSPKI(publicKeyPem, "RS256");
  return calculateJwkThumbprint(await exportJWK(key), "sha256");
}

/**
 * Auth0 client grants carry a subject type, and the two are not interchangeable:
 * "user" authorizes tokens issued on behalf of a signed-in user (the
 * authorization code flow), "client" authorizes the client credentials flow. An
 * application that needs both needs two grants.
 */
async function ensureGrants(
  label: string,
  clientId: string,
  subjectTypes: SubjectType[],
) {
  if (isPending(clientId)) {
    for (const subjectType of subjectTypes) {
      note("+", `${label}: ${subjectType}-subject grant`);
    }
    return;
  }

  const grants = await api(
    "GET",
    `/client-grants?client_id=${encodeURIComponent(clientId)}`,
  );

  for (const subjectType of subjectTypes) {
    const hasGrant = (grants as any[]).some(
      (grant) =>
        grant.audience === API_IDENTIFIER &&
        (grant.subject_type ?? "client") === subjectType,
    );

    if (hasGrant) {
      note("=", `${label}: ${subjectType}-subject grant`);
      continue;
    }

    await mutate("POST", "/client-grants", {
      client_id: clientId,
      audience: API_IDENTIFIER,
      scope: [API_SCOPE],
      subject_type: subjectType,
    });
    note("+", `${label}: ${subjectType}-subject grant`);
  }
}

async function ensureConnectionEnabled(clientIds: string[]) {
  const connections = await api("GET", "/connections");
  const connection = (connections as any[]).find((c) => c.name === CONNECTION);

  if (!connection) {
    fail(
      `connection "${CONNECTION}" not found. Create a database connection, or set E2E_AUTH0_CONNECTION.`,
    );
  }

  // Enabled clients moved off the connection object into their own sub-resource;
  // PATCHing `enabled_clients` on the connection is rejected outright.
  const { clients: enabledClients } = await api(
    "GET",
    `/connections/${connection.id}/clients`,
  );
  const enabled = new Set<string>(
    (enabledClients || []).map((client: any) => client.client_id),
  );

  const pending = clientIds.filter(isPending).length;
  const missing = clientIds.filter(
    (id) => !isPending(id) && !enabled.has(id),
  );

  if (missing.length + pending === 0) {
    note("=", `connection ${CONNECTION} enabled for every application`);
    return;
  }

  if (pending > 0 && missing.length === 0) {
    note(
      "~",
      `connection ${CONNECTION}: would enable ${pending} new application(s)`,
    );
    return;
  }

  await mutate(
    "PATCH",
    `/connections/${connection.id}/clients`,
    missing.map((client_id) => ({ client_id, status: true })),
  );
  note(
    "~",
    `connection ${CONNECTION}: enabled for ${missing.length} application(s)`,
  );
}

async function ensureUser(): Promise<{ email: string; password?: string }> {
  const found = await api(
    "GET",
    `/users-by-email?email=${encodeURIComponent(USER_EMAIL)}`,
  ).catch(() => []);

  if ((found as any[]).length > 0) {
    const existingPassword = readEnvValue("E2E_AUTH0_PASSWORD");
    if (existingPassword) {
      note("=", `test user ${USER_EMAIL}`);
      return { email: USER_EMAIL };
    }

    // The user exists but nothing here knows its password, which no API can read
    // back. Reset it so the specs have one.
    const password = generatePassword();
    await mutate(
      "PATCH",
      `/users/${encodeURIComponent((found as any[])[0].user_id)}`,
      {
        password,
        connection: CONNECTION,
      },
    );
    note(
      "~",
      `test user ${USER_EMAIL}: password reset (none was recorded locally)`,
    );
    return { email: USER_EMAIL, password };
  }

  const password = generatePassword();
  await mutate("POST", "/users", {
    email: USER_EMAIL,
    password,
    connection: CONNECTION,
    email_verified: true,
  });
  note("+", `test user ${USER_EMAIL}`);
  return { email: USER_EMAIL, password };
}

function generatePassword(): string {
  // Long, mixed, and never printed — it goes straight into .env.e2e.local.
  return `Aa1!${randomBytes(24).toString("base64url")}`;
}

// --- the env file -----------------------------------------------------------

/**
 * The endpoint the user-flow specs spend their access token on. A value left over
 * from another Auth0 tenant is worse than none — the token is valid, the call just
 * returns Unauthorized — so a stale one is replaced rather than preserved. A
 * genuinely custom endpoint elsewhere is left alone.
 */
function resolveApiEndpoint(issuer: string): string {
  const derived = `${issuer}/userinfo`;
  const existing = readEnvValue("E2E_AUTH0_API_ENDPOINT");
  if (!existing) return derived;

  try {
    const existingHost = new URL(existing).hostname;
    const issuerHost = new URL(issuer).hostname;
    if (
      existingHost !== issuerHost &&
      (existingHost === "auth0.com" || existingHost.endsWith(".auth0.com"))
    ) {
      return derived;
    }
  } catch {
    return derived;
  }

  return existing;
}

function readEnvValue(key: string): string {
  if (!existsSync(ENV_PATH)) return "";
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const match = new RegExp(String.raw`^\s*${key}\s*=\s*(.*)$`).exec(line);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

/** Rewrites only the keys it owns, so Entra configuration survives untouched. */
function writeEnv(values: Record<string, string>) {
  const owned = new Map(
    Object.entries(values).filter(([, value]) => value !== ""),
  );

  const lines = existsSync(ENV_PATH)
    ? readFileSync(ENV_PATH, "utf8").split("\n")
    : [];

  const merged = lines.map((line) => {
    const match = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    if (!match || !owned.has(match[1])) return line;
    const key = match[1];
    const value = owned.get(key)!;
    owned.delete(key);
    return `${key}=${value}`;
  });

  if (owned.size > 0) {
    if (merged.length && merged.at(-1) !== "") merged.push("");
    merged.push("# written by scripts/provision-auth0.ts");
    for (const [key, value] of owned) merged.push(`${key}=${value}`);
  }

  if (DRY_RUN) {
    console.log(
      `\n  would write ${Object.keys(values).length} keys to ${ENV_PATH}`,
    );
    return;
  }

  writeFileSync(ENV_PATH, merged.join("\n"), { mode: 0o600 });
  try {
    chmodSync(ENV_PATH, 0o600);
  } catch {
    // Ignore permissions failure on platforms or filesystems that do not support POSIX modes
  }
  console.log(`\n  wrote ${Object.keys(values).length} keys to ${ENV_PATH}`);
}

// --- run --------------------------------------------------------------------

async function main() {
  console.log(`\nprovisioning ${DOMAIN}${DRY_RUN ? "  (dry run)" : ""}\n`);

  await ensureTenantSettings();
  await ensureApi();

  const clients: Record<AppKey, Client> = {} as any;
  for (const key of Object.keys(APPS) as AppKey[]) {
    clients[key] = await ensureClient(key);
  }

  const { privateKeyPem, kid } = await ensurePrivateKeyJwt(
    clients.pkjwt.client_id,
  );

  for (const key of Object.keys(APPS) as AppKey[]) {
    await ensureGrants(key, clients[key].client_id, [...APPS[key].grants]);
  }

  await ensureConnectionEnabled([
    clients.spa.client_id,
    clients.web.client_id,
    clients.pkjwt.client_id,
  ]);

  const user = await ensureUser();

  const issuer = `https://${DOMAIN}`;
  const apiEndpoint = resolveApiEndpoint(issuer);
  // Only known when the user was just created or reset; otherwise it is whatever
  // is already recorded, since no API can read a password back.
  const password = user.password || readEnvValue("E2E_AUTH0_PASSWORD");
  writeEnv({
    E2E_AUTH0_ISSUER_URL: issuer,
    E2E_AUTH0_PUBLIC_CLIENT_ID: clients.spa.client_id,
    E2E_AUTH0_CONFIDENTIAL_CLIENT_ID: clients.web.client_id,
    E2E_AUTH0_CLIENT_SECRET: clients.web.client_secret ?? "",
    E2E_AUTH0_M2M_CLIENT_ID: clients.m2m.client_id,
    E2E_AUTH0_M2M_CLIENT_SECRET: clients.m2m.client_secret ?? "",
    E2E_AUTH0_AUDIENCE: API_IDENTIFIER,
    E2E_AUTH0_API_ENDPOINT: apiEndpoint,
    E2E_AUTH0_USER_SCOPES: `openid profile email ${API_SCOPE}`,
    E2E_AUTH0_USERNAME: user.email,
    ...(password ? { E2E_AUTH0_PASSWORD: password } : {}),
    E2E_AUTH0_PRIVATE_KEY_PEM: privateKeyPem.trim().replaceAll("\n", String.raw`\n`),
    E2E_AUTH0_CREDENTIAL_KID: kid,
    // One application serves client credentials, confidential authorization code
    // and PAR/JAR, so both point at it.
    E2E_AUTH0_PKJWT_ISSUER_URL: issuer,
    E2E_AUTH0_PKJWT_CLIENT_ID: clients.pkjwt.client_id,
    E2E_AUTH0_PKJWT_M2M_CLIENT_ID: clients.pkjwt.client_id,
    E2E_AUTH0_PKJWT_AUDIENCE: API_IDENTIFIER,
    E2E_AUTH0_PKJWT_API_ENDPOINT: apiEndpoint,
    // Every E2E_AUTH0_PKJWT_* value is an override that wins over its plain
    // counterpart, so all of them have to be rewritten. One left pointing at a
    // previous tenant beats the correct value silently — a sign-in that fails
    // with "Wrong email or password" while the right credentials sit one
    // variable away.
    E2E_AUTH0_PKJWT_USERNAME: user.email,
    ...(password ? { E2E_AUTH0_PKJWT_PASSWORD: password } : {}),
  });

  const appliedSuffix = DRY_RUN ? " would be applied" : " applied";
  if (changes.length === 0) {
    console.log("\nnothing to change — the tenant already matches.\n");
  } else {
    console.log(`\n${changes.length} change(s)${appliedSuffix}.\n`);
  }
}

try {
  await main();
} catch (error) {
  fail(String(error));
}
