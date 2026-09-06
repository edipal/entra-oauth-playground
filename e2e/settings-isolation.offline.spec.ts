import { type Page } from "@playwright/test";
import { expect, test } from "./support/offlineTest";
import { FlowPage } from "./support/flow";
import {
  DEMO,
  defaultsFor,
  readRawKey,
  readRawSettings,
  readSettings,
  seedRawKey,
  seedRawSettings,
  seedSettings,
  type ProviderId,
} from "./support/settings";
import { stubAuth0Discovery } from "./support/stubProvider";

// The workspace split is the app's central promise: two identity providers
// configured side by side, neither able to see or corrupt the other's settings.
// Each workspace owns one localStorage key, and every flow inside it owns its own
// section of that key.
//
// Nothing here contacts an identity provider.

const PUBLIC_CLIENT = "authorization-code/public-client";

const AUTH0_DEFAULT_AUTH_CODE_SCOPES = "openid profile email offline_access";
const ENTRA_DEFAULT_AUTH_CODE_SCOPES = "openid profile offline_access";

const WORKSPACE_LABEL = {
  entra: "Microsoft Entra ID",
  auth0: "Auth0",
} as const;

/** Switches workspace the way a user does, through the sidebar selector. */
async function switchWorkspace(page: Page, providerId: ProviderId) {
  await page.locator(".provider-selector-sidebar .p-dropdown").click();
  await page
    .locator(".p-dropdown-panel .p-dropdown-item", {
      hasText: WORKSPACE_LABEL[providerId],
    })
    .first()
    .click();

  await expect(page).toHaveURL(new RegExp(`/en/${providerId}/`));
}

test.describe("Workspace settings isolation", () => {
  test("neither workspace can see what the other holds", async ({ page }) => {
    await stubAuth0Discovery(page);
    await seedSettings(page, "entra", {
      authCodePublicClient: defaultsFor("entra", {
        scopes: "openid profile User.Read",
      }),
    });

    const flow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await flow.goto();
    await flow.expectStep("Settings");
    // the seeded value showing is also the signal that hydration is done, so the
    // typing below cannot be overwritten by it
    await expect(page.locator("#tenantId")).toHaveValue(DEMO.entraTenant);

    await switchWorkspace(page, "auth0");

    // Auth0 asks a different question and starts from its own defaults
    await expect(page.locator("#tenantId")).toHaveCount(0);
    await expect(page.locator("#issuerUrl")).toHaveValue("");
    await expect(page.locator("#clientId")).toHaveValue("");
    await expect(page.locator("#scopes")).toHaveValue(
      AUTH0_DEFAULT_AUTH_CODE_SCOPES,
    );
    // an API audience is an Auth0 concept; Entra has no such field
    await expect(page.locator("#audience")).toBeVisible();

    await page.locator("#issuerUrl").fill(DEMO.auth0Issuer);
    await page.locator("#clientId").fill(DEMO.auth0Client);
    await page.locator("#audience").fill(DEMO.auth0Audience);
    await page.locator("#scopes").fill("openid profile email read:orders");

    await switchWorkspace(page, "entra");

    // and back: nothing typed in the Auth0 workspace reached this one
    await expect(page.locator("#tenantId")).toHaveValue(DEMO.entraTenant);
    await expect(page.locator("#clientId")).toHaveValue(DEMO.entraClient);
    await expect(page.locator("#scopes")).toHaveValue(
      "openid profile User.Read",
    );
    await expect(page.locator("#audience")).toHaveCount(0);
    await expect(page.locator("#issuerUrl")).toHaveCount(0);

    const entra = (await readSettings(page, "entra")).authCodePublicClient;
    const auth0 = (await readSettings(page, "auth0")).authCodePublicClient;

    expect(entra.tenantId).toBe(DEMO.entraTenant);
    expect(entra.clientId).toBe(DEMO.entraClient);
    expect(entra.issuerUrl).toBe("");
    expect(entra.audience).toBe("");
    expect(entra.providerId).toBe("entra");

    expect(auth0.issuerUrl).toBe(DEMO.auth0Issuer);
    expect(auth0.clientId).toBe(DEMO.auth0Client);
    expect(auth0.audience).toBe(DEMO.auth0Audience);
    expect(auth0.tenantId).toBe("");
    expect(auth0.providerId).toBe("auth0");

    // the identifiers are the values most damaging to share
    expect(auth0.clientId).not.toBe(entra.clientId);
    expect(auth0.scopes).not.toBe(entra.scopes);
  });

  test("each workspace is restored from its own key", async ({ page }) => {
    await stubAuth0Discovery(page);
    await seedSettings(page, "entra", {
      authCodePublicClient: defaultsFor("entra", {
        scopes: "openid profile Mail.Read",
      }),
    });
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        scopes: "openid profile read:invoices",
      }),
    });

    const entraFlow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await entraFlow.goto();
    await expect(page.locator("#tenantId")).toHaveValue(DEMO.entraTenant);
    await expect(page.locator("#scopes")).toHaveValue(
      "openid profile Mail.Read",
    );

    // a full navigation, not a workspace switch: hydration has to pick the key
    const auth0Flow = new FlowPage(page, "auth0", PUBLIC_CLIENT);
    await auth0Flow.goto();
    await expect(page.locator("#issuerUrl")).toHaveValue(DEMO.auth0Issuer);
    await expect(page.locator("#scopes")).toHaveValue(
      "openid profile read:invoices",
    );
    await expect(page.locator("#tenantId")).toHaveCount(0);
  });

  test("a workspace cannot be made to impersonate the other provider", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);
    // localStorage is user-editable, so the provider a workspace claims to be
    // must never decide how it behaves — the route does.
    await seedSettings(page, "auth0", {
      authCodePublicClient: {
        providerId: "entra",
        tenantId: DEMO.entraTenant,
        clientId: DEMO.auth0Client,
        issuerUrl: DEMO.auth0Issuer,
      },
    });

    const flow = new FlowPage(page, "auth0", PUBLIC_CLIENT);
    await flow.goto();
    await expect(page.locator("#issuerUrl")).toHaveValue(DEMO.auth0Issuer);
    await expect(page.locator("#tenantId")).toHaveCount(0);

    // the smuggled provider is corrected the first time the workspace is written
    await page.locator("#clientId").fill(DEMO.auth0Client);
    await expect
      .poll(
        async () =>
          (await readSettings(page, "auth0")).authCodePublicClient.providerId,
      )
      .toBe("auth0");
  });

  test("flows inside a workspace keep their own settings", async ({ page }) => {
    await stubAuth0Discovery(page);
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        clientId: "auth0-public-client-id",
      }),
      clientCredentials: defaultsFor("auth0", {
        clientId: "auth0-machine-client-id",
        scopes: "",
      }),
    });

    const publicClient = new FlowPage(page, "auth0", PUBLIC_CLIENT);
    await publicClient.goto();
    await expect(page.locator("#clientId")).toHaveValue(
      "auth0-public-client-id",
    );

    const clientCredentials = new FlowPage(page, "auth0", "client-credentials");
    await clientCredentials.goto();
    await expect(page.locator("#clientId")).toHaveValue(
      "auth0-machine-client-id",
    );
    // and the two flows do not share a scope set either
    await expect(page.locator("#scopes")).toHaveValue("");
  });

  test("an unreadable workspace does not take the other one down with it", async ({
    page,
  }) => {
    // Hydration used to read both keys inside one try/catch, so a single
    // unparseable value skipped the state update entirely and left *both*
    // workspaces at defaults — and the first edit in the healthy one wrote those
    // defaults over its stored settings.
    await stubAuth0Discovery(page);
    await seedSettings(page, "entra", {
      authCodePublicClient: defaultsFor("entra", {
        clientId: "entra-survivor-client-id",
        scopes: "openid profile User.Read",
      }),
    });
    await seedRawSettings(page, "auth0", '{"authCodePublicClient":{"clie');

    const flow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await flow.goto();
    await flow.expectStep("Settings");

    // the healthy workspace still hydrates
    await expect(page.locator("#clientId")).toHaveValue(
      "entra-survivor-client-id",
    );
    await expect(page.locator("#scopes")).toHaveValue(
      "openid profile User.Read",
    );

    // and an edit here persists on top of the seeded values rather than defaults
    await page.locator("#scopes").fill("openid profile Mail.Read");
    await expect
      .poll(
        async () =>
          (await readSettings(page, "entra")).authCodePublicClient.clientId,
      )
      .toBe("entra-survivor-client-id");

    // the value that could not be read is kept, not silently discarded
    expect(await readRawSettings(page, "auth0", ":corrupt")).toBe(
      '{"authCodePublicClient":{"clie',
    );
    expect(await readRawSettings(page, "auth0")).toBeNull();
  });

  test("settings from before the workspace split are carried over", async ({
    page,
  }) => {
    // Everything persisted to one `app:settings` key until this branch, when
    // Entra was the only provider. Reading only the new keys left an upgrading
    // user at an empty Settings step with their configuration still in
    // localStorage, unread and unreachable.
    const legacy = JSON.stringify({
      authCodePublicClient: {
        tenantId: DEMO.entraTenant,
        clientId: "legacy-entra-client-id",
        scopes: "openid profile User.Read",
      },
    });
    await seedRawKey(page, "app:settings", legacy);

    const flow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await flow.goto();
    await flow.expectStep("Settings");

    await expect(page.locator("#clientId")).toHaveValue(
      "legacy-entra-client-id",
    );
    await expect(page.locator("#scopes")).toHaveValue(
      "openid profile User.Read",
    );

    // renamed rather than deleted, and gone from the key that would migrate again
    expect(await readRawKey(page, "app:settings:migrated")).toBe(legacy);
    expect(await readRawKey(page, "app:settings")).toBeNull();

    // the Auth0 workspace was never part of that data and stays at its defaults
    await switchWorkspace(page, "auth0");
    await expect(page.locator("#clientId")).toHaveValue("");
    await expect(page.locator("#scopes")).toHaveValue(
      AUTH0_DEFAULT_AUTH_CODE_SCOPES,
    );
  });

  test("a configured workspace is never replaced by the legacy key", async ({
    page,
  }) => {
    await seedRawKey(
      page,
      "app:settings",
      JSON.stringify({
        authCodePublicClient: { clientId: "legacy-entra-client-id" },
      }),
    );
    await seedSettings(page, "entra", {
      authCodePublicClient: defaultsFor("entra", {
        clientId: "current-entra-client-id",
      }),
    });

    const flow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await flow.goto();
    await flow.expectStep("Settings");

    await expect(page.locator("#clientId")).toHaveValue(
      "current-entra-client-id",
    );
  });

  test("erasing a flow leaves nothing of the old configuration behind", async ({
    page,
  }) => {
    // Erase used to hand the merging setter a hand-written list of fields, so
    // whichever fields the list had not caught up with survived — `authRequestMode`
    // and `rarJson` outlived an erase and left a stripped flow still set to
    // PAR + JAR. Asserting equality with the defaults rather than field by field
    // is deliberate: a per-field assertion would repeat the original mistake.
    await stubAuth0Discovery(page);
    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: defaultsFor("auth0", {
        clientId: "auth0-confidential-client-id",
        authRequestMode: "par-jar",
        rarJson: '[{"type":"payment_initiation"}]',
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await expect(page.locator("#clientId")).toHaveValue(
      "auth0-confidential-client-id",
    );

    await page.getByRole("button", { name: "Erase settings" }).click();
    await expect(page.locator("#clientId")).toHaveValue("");

    const erased = (await readSettings(page, "auth0"))
      .authCodeConfidentialClient;
    expect(erased.authRequestMode).toBe("url");
    expect(erased.rarJson).toBe("");

    // and a second workspace's settings are untouched by an erase in this one
    const untouched = await readSettings(page, "entra");
    expect(untouched?.authCodeConfidentialClient?.clientId ?? "").toBe("");
  });

  test("provider defaults differ per flow before anything is configured", async ({
    page,
  }) => {
    await stubAuth0Discovery(page);

    const entraFlow = new FlowPage(page, "entra", PUBLIC_CLIENT);
    await entraFlow.goto();
    await expect(page.locator("#scopes")).toHaveValue(
      ENTRA_DEFAULT_AUTH_CODE_SCOPES,
    );

    const entraMachine = new FlowPage(page, "entra", "client-credentials");
    await entraMachine.goto();
    await expect(page.locator("#scopes")).toHaveValue(
      "https://graph.microsoft.com/.default",
    );

    // Auth0 has no equivalent default: the API audience carries that meaning
    const auth0Flow = new FlowPage(page, "auth0", PUBLIC_CLIENT);
    await auth0Flow.goto();
    await expect(page.locator("#scopes")).toHaveValue(
      AUTH0_DEFAULT_AUTH_CODE_SCOPES,
    );
  });
});
