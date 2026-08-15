import { expect, test, type Page } from "@playwright/test";
import { FlowPage } from "./support/flow";
import { defaultsFor, seedSettings, DEMO } from "./support/settings";
import { prepareAuthorizeRequest } from "./support/authCode";

// How each Auth0 authorization request mode leaves the app. The two server routes
// and the provider are stubbed, so nothing here contacts Auth0 — the assertions are
// on the URL the app sends the popup to and on the bodies it posts, which is where
// every PAR/JAR decision actually lands.

const REQUEST_URI = "urn:ietf:params:oauth:request_uri:demo-request-uri";
const REQUEST_OBJECT = "eyJhbGciOiJSUzI1NiJ9.stub-request-object.signature";
const DEMO_KEY = "-----BEGIN PRIVATE KEY-----\nstub\n-----END PRIVATE KEY-----";

type Stubs = {
  parBodies: Record<string, unknown>[];
  requestObjectBodies: Record<string, unknown>[];
};

/**
 * Stubs both Auth0 server routes and the provider itself, recording what the app
 * posted. `parStatus` drives the failure cases.
 */
async function stubAuth0(
  page: Page,
  options: { parStatus?: number } = {},
): Promise<Stubs> {
  const stubs: Stubs = { parBodies: [], requestObjectBodies: [] };

  await page.route("**/api/oauth/auth0/par", async (route) => {
    stubs.parBodies.push(route.request().postDataJSON());
    const status = options.parStatus ?? 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(
        status === 200 ? { request_uri: REQUEST_URI } : { error: "par_failed" },
      ),
    });
  });

  await page.route("**/api/oauth/auth0/request-object", async (route) => {
    stubs.requestObjectBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ request: REQUEST_OBJECT }),
    });
  });

  // Stub only the authorize page the popup would land on. The tenant's discovery
  // document must still be fetched for real, because the app resolves its
  // authorization and token endpoints from it and will not leave Settings without
  // them.
  await page.context().route(`${DEMO.auth0Issuer}/authorize*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>stub authorize</body></html>",
    }),
  );

  return stubs;
}

/** Clicks "Open popup" and returns the URL the popup was actually sent to. */
async function launchedUrl(page: Page): Promise<URL> {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open popup" }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/\/authorize/, { timeout: 15_000 });
  const url = new URL(popup.url());
  await popup.close();
  return url;
}

async function openConfidentialAuthorize(page: Page, mode: string) {
  await seedSettings(page, "auth0", {
    authCodeConfidentialClient: defaultsFor("auth0", {
      pkceEnabled: true,
      authRequestMode: mode as never,
    }),
  });

  const flow = new FlowPage(
    page,
    "auth0",
    "authorization-code/confidential-client",
  );
  await flow.goto();
  await flow.advanceTo("Authorize");
  await prepareAuthorizeRequest(flow);
  return flow;
}

test.describe("Auth0 request modes", () => {
  test("the confidential client offers every mode", async ({ page }) => {
    await openConfidentialAuthorize(page, "url");

    await page.locator("#auth0RequestMode").click();
    const options = page.locator(".p-dropdown-panel .p-dropdown-item");
    await expect(options).toHaveText(["URL", "PAR", "JAR", "PAR + JAR"]);
  });

  test("PAR launches with a request_uri instead of the parameters", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "par");

    const url = await launchedUrl(page);
    const params = Object.fromEntries(url.searchParams);

    expect(url.pathname).toBe("/authorize");
    // the whole point of PAR: the browser carries a reference, not the request
    expect(Object.keys(params).sort()).toEqual(["client_id", "request_uri"]);
    expect(params.request_uri).toBe(REQUEST_URI);
    expect(params).not.toHaveProperty("scope");
    expect(params).not.toHaveProperty("code_challenge");

    // and the parameters really were pushed
    expect(stubs.parBodies).toHaveLength(1);
    const pushed = stubs.parBodies[0].authorizationParams as Record<
      string,
      string
    >;
    expect(pushed.client_id).toBe(DEMO.auth0Client);
    expect(pushed.code_challenge_method).toBe("S256");
  });

  test("JAR launches with a signed request object", async ({ page }) => {
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "jar");

    // the signing key is supplied on this step, in the same forward pass
    await page.locator("#auth0RequestObjectKey").fill(DEMO_KEY);
    await page.locator("#auth0RequestObjectKid").fill("demo-kid");

    const url = await launchedUrl(page);
    const params = Object.fromEntries(url.searchParams);

    expect(Object.keys(params).sort()).toEqual(["client_id", "request"]);
    expect(params.request).toBe(REQUEST_OBJECT);

    expect(stubs.requestObjectBodies).toHaveLength(1);
    expect(stubs.requestObjectBodies[0].kid).toBe("demo-kid");
    expect(stubs.parBodies, "JAR alone must not push").toHaveLength(0);
  });

  test("PAR + JAR pushes the request object rather than the parameters", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "par-jar");

    await page.locator("#auth0RequestObjectKey").fill(DEMO_KEY);

    const url = await launchedUrl(page);
    expect(Object.keys(Object.fromEntries(url.searchParams)).sort()).toEqual([
      "client_id",
      "request_uri",
    ]);

    expect(stubs.requestObjectBodies).toHaveLength(1);
    expect(stubs.parBodies).toHaveLength(1);
    const pushed = stubs.parBodies[0].authorizationParams as Record<
      string,
      string
    >;
    // the push carries the object, not the parameters it was built from
    expect(Object.keys(pushed).sort()).toEqual(["client_id", "request"]);
    expect(pushed.request).toBe(REQUEST_OBJECT);
  });

  test("JAR without a key stops with an error instead of launching", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "jar");

    await page.getByRole("button", { name: "Open popup" }).click();

    await expect(
      page.getByText("JAR requires a runtime private key", { exact: false }),
    ).toBeVisible();
    expect(stubs.requestObjectBodies).toHaveLength(0);
  });

  test("a failed PAR push does not fall back to a plain authorization URL", async ({
    page,
  }) => {
    // The deliberate behaviour: a selected mode either works or reports why. A
    // silent fallback would send the request the user did not ask for.
    await stubAuth0(page, { parStatus: 400 });
    await openConfidentialAuthorize(page, "par");

    let navigated = "";
    page.on("popup", (popup) => {
      popup.on("framenavigated", () => {
        if (popup.url().includes("/authorize")) navigated = popup.url();
      });
    });

    await page.getByRole("button", { name: "Open popup" }).click();

    await expect(page.getByText("PAR request failed.")).toBeVisible();
    expect(navigated, "no authorization request may be sent").toBe("");
  });

  test("rich authorization details reach the pushed request", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);

    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: defaultsFor("auth0", {
        pkceEnabled: true,
        authRequestMode: "par",
        rarJson:
          '[ { "type" : "payment_initiation", "actions" : [ "read" ] } ]',
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");
    await prepareAuthorizeRequest(flow);

    await launchedUrl(page);

    const pushed = stubs.parBodies[0].authorizationParams as Record<
      string,
      string
    >;
    // normalized to compact JSON on the way out, not the raw textarea content
    expect(pushed.authorization_details).toBe(
      '[{"type":"payment_initiation","actions":["read"]}]',
    );
  });
});

test.describe("Auth0 request modes, public client", () => {
  test("offers no request mode at all", async ({ page }) => {
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", { pkceEnabled: true }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    // Auth0 supports PAR for confidential clients only, and a public client has
    // nothing to authenticate the push with.
    await expect(page.locator("#auth0RequestMode")).toHaveCount(0);
    // the Auth0 parameter surface is still there
    await expect(page.locator("#auth0Connection")).toBeVisible();
  });

  test("a persisted PAR mode falls back to a plain URL request", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);

    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        pkceEnabled: true,
        authRequestMode: "par",
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/public-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");
    await prepareAuthorizeRequest(flow);

    const url = await launchedUrl(page);
    const params = Object.fromEntries(url.searchParams);

    expect(params.code_challenge_method).toBe("S256");
    expect(params).not.toHaveProperty("request_uri");
    expect(stubs.parBodies, "nothing may be pushed").toHaveLength(0);
  });
});
