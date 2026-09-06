import { type Page } from "@playwright/test";
import { expect, test } from "./support/offlineTest";
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

  // Only the authorize page the popup would land on. Discovery is stubbed for
  // every spec by the hermetic fixture in support/offlineTest.
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
    const flow = await openConfidentialAuthorize(page, "url");

    await flow.dropdown("auth0RequestMode").click();
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

  test("PAR asks for the client secret on the step that pushes", async ({
    page,
  }) => {
    // The push is an authenticated call, and client authentication is two steps
    // further on. Without the field here the default secret client cannot push
    // at all, and there is nowhere to go back to.
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "par");

    const secret = page.locator("#auth0ParClientSecret");
    await expect(secret).toBeVisible();
    await secret.fill("demo-client-secret");

    await launchedUrl(page);

    expect(stubs.parBodies[0].clientAuthMethod).toBe("secret");
    expect(stubs.parBodies[0].clientSecret).toBe("demo-client-secret");
  });

  test("PAR allows choosing between client secret and private key on Authorize step", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);
    const flow = await openConfidentialAuthorize(page, "par");

    // By default, client secret is selected and input is visible
    await expect(page.locator("#auth0ClientAuthMethod")).toBeVisible();
    await expect(page.locator("#auth0ParClientSecret")).toBeVisible();
    await expect(page.locator("#auth0RequestObjectKey")).toHaveCount(0);

    // Switch to private key
    await flow.chooseDropdown(
      "auth0ClientAuthMethod",
      "Private key (private_key_jwt)",
    );

    // Client secret is now hidden, private key fields are visible
    await expect(page.locator("#auth0ParClientSecret")).toHaveCount(0);
    const key = page.locator("#auth0RequestObjectKey");
    await expect(key).toBeVisible();
    await key.fill(DEMO_KEY);
    await page.locator("#auth0RequestObjectKid").fill("demo-kid");

    await launchedUrl(page);

    expect(stubs.parBodies[0].clientAuthMethod).toBe("certificate");
    expect(stubs.parBodies[0].privateKeyPem).toBe(DEMO_KEY);
    expect(stubs.parBodies[0].clientAssertionKid).toBe("demo-kid");
  });

  test("PAR supports explicit two-phase push and inspect before launch", async ({
    page,
  }) => {
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "par");

    const secret = page.locator("#auth0ParClientSecret");
    await secret.fill("demo-client-secret");

    // Phase 1: PAR request preview is visible with endpoint and parameters.
    // The endpoint shown must be the one the server route will post to — it pins
    // the endpoint to the allowlisted issuer, so a preview taken from the
    // discovery document could name somewhere the push never goes.
    await expect(page.locator("#parEndpointPreview")).toHaveValue(
      `${DEMO.auth0Issuer}/oauth/par`,
    );
    await expect(page.locator("#parRequestPreview")).toBeVisible();

    // Click "Push to PAR"
    const pushButton = page.getByRole("button", { name: "Push to PAR" });
    await expect(pushButton).toBeVisible();
    await pushButton.click();

    // Response panel appears with status and JSON containing request_uri
    await expect(page.locator("#parResponseText")).toBeVisible();
    expect(await page.locator("#parResponseText").inputValue()).toContain(
      "urn:ietf:params:oauth:request_uri:demo-request-uri",
    );

    // Phase 2: Authorization URL Preview now shows the clean request_uri URL
    const previewUrl = await page.locator("#authUrlPreview").inputValue();
    expect(previewUrl).toContain("request_uri=");
    expect(previewUrl).not.toContain("authorization_details=");

    // Launch popup
    const url = await launchedUrl(page);
    expect(url.searchParams.get("request_uri")).toBe(REQUEST_URI);
    expect(url.searchParams.get("client_id")).toBe(DEMO.auth0Client);

    // one push, and the launch used what it produced
    expect(stubs.parBodies).toHaveLength(1);
  });

  test("a second launch pushes again rather than replaying the request_uri", async ({
    page,
  }) => {
    // RFC 9126 2.2: a request_uri "MUST be used only once", and Auth0 expires it
    // within about ninety seconds. Caching it across launches sent the second one
    // to a value the authorization server had already consumed, which surfaced as
    // an unexplained Auth0 error rather than as anything this app said.
    const stubs = await stubAuth0(page);
    await openConfidentialAuthorize(page, "par");
    await page.locator("#auth0ParClientSecret").fill("demo-client-secret");

    await page.getByRole("button", { name: "Push to PAR" }).click();
    await expect(page.locator("#parResponseText")).toBeVisible();

    const first = await launchedUrl(page);
    expect(first.searchParams.get("request_uri")).toBe(REQUEST_URI);
    expect(stubs.parBodies).toHaveLength(1);

    // nothing about the request changed, and it still must not be replayed
    const second = await launchedUrl(page);
    expect(second.searchParams.get("request_uri")).toBe(REQUEST_URI);
    expect(stubs.parBodies).toHaveLength(2);
  });

  test("a failed push is reported on the step that pushed", async ({
    page,
  }) => {
    // The message used to be written to the launch error, which renders in the
    // browser-authorization card further down — under a button that had not been
    // pressed and had not failed.
    await stubAuth0(page, { parStatus: 400 });
    await openConfidentialAuthorize(page, "par");
    await page.locator("#auth0ParClientSecret").fill("demo-client-secret");

    await page.getByRole("button", { name: "Push to PAR" }).click();

    const parCard = page.locator("#pushParButton").locator("..");
    await expect(parCard.locator(".p-error")).toHaveText(/PAR/i);
    // and the response body is still shown, so the status is readable
    expect(await page.locator("#parResponseText").inputValue()).toContain(
      "par_failed",
    );
  });

  test("a plain URL request asks for no credential", async ({ page }) => {
    await openConfidentialAuthorize(page, "url");

    await expect(page.locator("#auth0ParClientSecret")).toHaveCount(0);
    await expect(page.locator("#auth0RequestObjectKey")).toHaveCount(0);
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
