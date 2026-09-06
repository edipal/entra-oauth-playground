import { expect, test } from "./support/offlineTest";
import { FlowPage } from "./support/flow";
import { defaultsFor, seedSettings, DEMO } from "./support/settings";

// Exhaustive coverage of how the authorization request is built. No identity
// provider is contacted: the assertions are on the URL the app would open, which
// is where every provider- and option-specific decision lands.

const AUTH_CODE_ROUTES = [
  "authorization-code/public-client",
  "authorization-code/confidential-client",
] as const;

test.describe("Entra authorization request", () => {
  for (const route of AUTH_CODE_ROUTES) {
    for (const pkceEnabled of [true, false]) {
      test(`${route} pkce=${pkceEnabled}`, async ({ page }) => {
        await seedSettings(page, "entra", {
          [route.endsWith("public-client")
            ? "authCodePublicClient"
            : "authCodeConfidentialClient"]: defaultsFor("entra", {
            pkceEnabled,
          }),
        });

        const flow = new FlowPage(page, "entra", route);
        await flow.goto();
        await flow.advanceTo("Authorize");

        const url = await flow.authorizeUrl();
        const params = Object.fromEntries(url.searchParams);

        expect(url.origin).toBe("https://login.microsoftonline.com");
        expect(url.pathname).toBe(`/${DEMO.entraTenant}/oauth2/v2.0/authorize`);
        expect(params.client_id).toBe(DEMO.entraClient);
        expect(params.response_type).toBe("code");
        expect(params.scope).toBe("openid profile offline_access");
        expect(params.redirect_uri).toContain("/callback/auth-code");

        if (pkceEnabled) {
          expect(params.code_challenge_method).toBe("S256");
          expect(params.code_challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
        } else {
          expect(params).not.toHaveProperty("code_challenge");
          expect(params).not.toHaveProperty("code_challenge_method");
        }

        // Auth0-only parameters must never appear on an Entra request
        for (const auth0Only of [
          "connection",
          "organization",
          "screen_hint",
          "audience",
          "authorization_details",
        ]) {
          expect(params).not.toHaveProperty(auth0Only);
        }
      });
    }
  }

  for (const responseMode of ["query", "form_post"] as const) {
    test(`response_mode=${responseMode} is Entra-only and reaches the URL`, async ({
      page,
    }) => {
      await seedSettings(page, "entra", {
        authCodePublicClient: defaultsFor("entra"),
      });

      const flow = new FlowPage(page, "entra", AUTH_CODE_ROUTES[0]);
      await flow.goto();
      await flow.advanceTo("Authorize");
      await flow.chooseDropdown("responseMode", responseMode);

      expect((await flow.authorizeParams()).response_mode).toBe(responseMode);
    });
  }

  for (const prompt of ["login", "consent", "select_account", "none"]) {
    test(`prompt=${prompt}`, async ({ page }) => {
      await seedSettings(page, "entra", {
        authCodePublicClient: defaultsFor("entra"),
      });

      const flow = new FlowPage(page, "entra", AUTH_CODE_ROUTES[0]);
      await flow.goto();
      await flow.advanceTo("Authorize");
      await flow.chooseDropdown("prompt", prompt);

      expect((await flow.authorizeParams()).prompt).toBe(prompt);
    });
  }
});

test.describe("Auth0 authorization request", () => {
  for (const route of AUTH_CODE_ROUTES) {
    for (const pkceEnabled of [true, false]) {
      test(`${route} pkce=${pkceEnabled}`, async ({ page }) => {
        const flowKey = route.endsWith("public-client")
          ? "authCodePublicClient"
          : "authCodeConfidentialClient";

        await seedSettings(page, "auth0", {
          [flowKey]: defaultsFor("auth0", { pkceEnabled }),
        });

        const flow = new FlowPage(page, "auth0", route);
        await flow.goto();
        await flow.advanceTo("Authorize");

        const url = await flow.authorizeUrl();
        const params = Object.fromEntries(url.searchParams);

        expect(url.origin).toBe(DEMO.auth0Issuer);
        expect(url.pathname).toBe("/authorize");
        expect(params.client_id).toBe(DEMO.auth0Client);
        expect(params.audience).toBe(DEMO.auth0Audience);
        expect(params.scope).toBe("openid profile email offline_access");

        if (pkceEnabled) {
          expect(params.code_challenge_method).toBe("S256");
        } else {
          expect(params).not.toHaveProperty("code_challenge");
        }

        // response_mode is Entra-only and must not leak into an Auth0 request
        expect(params).not.toHaveProperty("response_mode");
      });
    }
  }

  test("select_account is not offered as an Auth0 prompt", async ({ page }) => {
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0"),
    });

    const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
    await flow.goto();
    await flow.advanceTo("Authorize");

    await flow.dropdown("prompt").click();
    const options = await page
      .locator(".p-dropdown-panel .p-dropdown-item")
      .allInnerTexts();

    expect(options.map((o) => o.trim())).toEqual(["login", "consent", "none"]);
  });

  const AUTH0_PARAMS = [
    ["auth0Connection", "connection", "Username-Password-Authentication"],
    ["auth0Organization", "organization", "org_1234567890"],
    ["auth0MaxAge", "max_age", "3600"],
    ["auth0UiLocales", "ui_locales", "en de"],
    ["auth0AcrValues", "acr_values", "urn:mace:incommon:iap:silver"],
    ["auth0ClaimsLocales", "claims_locales", "en de"],
  ] as const;

  for (const [inputId, param, value] of AUTH0_PARAMS) {
    test(`${param} reaches the authorization URL`, async ({ page }) => {
      await seedSettings(page, "auth0", {
        authCodePublicClient: defaultsFor("auth0"),
      });

      const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
      await flow.goto();
      await flow.advanceTo("Authorize");
      await flow.fill(inputId, value);

      expect((await flow.authorizeParams())[param]).toBe(value);
    });
  }

  test("connection_scope appears only once a connection is set", async ({
    page,
  }) => {
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0"),
    });

    const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
    await flow.goto();
    await flow.advanceTo("Authorize");

    await expect(page.locator("#auth0ConnectionScope")).toBeHidden();
    await flow.fill("auth0Connection", "google-oauth2");
    await expect(page.locator("#auth0ConnectionScope")).toBeVisible();

    await flow.fill("auth0ConnectionScope", "read:contacts");
    const params = await flow.authorizeParams();
    expect(params.connection).toBe("google-oauth2");
    expect(params.connection_scope).toBe("read:contacts");
  });

  test("invitation appears only once an organization is set", async ({
    page,
  }) => {
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0"),
    });

    const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
    await flow.goto();
    await flow.advanceTo("Authorize");

    await expect(page.locator("#auth0Invitation")).toBeHidden();
    await flow.fill("auth0Organization", "org_123");
    await expect(page.locator("#auth0Invitation")).toBeVisible();
  });
});

test.describe("Rich Authorization Requests", () => {
  const VALID = '[{"type":"payment_initiation"}]';

  test("valid RAR is sent compacted", async ({ page }) => {
    await seedSettings(page, "auth0", {
      authCodePublicClient: defaultsFor("auth0", {
        rarJson: '[\n  {\n    "type": "payment_initiation"\n  }\n]',
      }),
    });

    const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
    await flow.goto();
    await flow.advanceTo("Authorize");

    expect((await flow.authorizeParams()).authorization_details).toBe(VALID);
  });

  const INVALID: [string, string][] = [
    ["malformed JSON", "{"],
    ["not an array", '{"type":"a"}'],
    ["empty array", "[]"],
    ["entry not an object", '["a"]'],
    ["entry without type", "[{}]"],
  ];

  for (const [label, rarJson] of INVALID) {
    test(`invalid RAR (${label}) blocks launch and shows an error`, async ({
      page,
    }) => {
      await seedSettings(page, "auth0", {
        authCodePublicClient: defaultsFor("auth0", { rarJson }),
      });

      const flow = new FlowPage(page, "auth0", AUTH_CODE_ROUTES[0]);
      await flow.goto();
      await flow.advanceTo("Authorize");

      await expect(page.locator("#auth0RarJsonError")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open popup" }),
      ).toBeDisabled();

      // the bad value must not reach the URL
      expect(await flow.authorizeParams()).not.toHaveProperty(
        "authorization_details",
      );
    });
  }
});
