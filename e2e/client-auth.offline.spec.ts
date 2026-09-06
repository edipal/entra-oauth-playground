import { expect, test } from "./support/offlineTest";
import { FlowPage } from "./support/flow";
import { defaultsFor, seedSettings } from "./support/settings";

// What the client-authentication step requires before it will let the flow
// continue. The two providers identify an assertion key differently — Entra by
// the SHA-1 thumbprint of a certificate (x5t), Auth0 by a key id it generates
// itself — and the step has to ask for the right one. No identity provider is
// contacted: every assertion is on the step's own gating.

const KEY_PAIR_TIMEOUT = 30_000;

test.describe("Auth0 client authentication", () => {
  test("asks for a private key and a kid, and never for a certificate", async ({
    page,
  }) => {
    await seedSettings(page, "auth0", {
      clientCredentials: defaultsFor("auth0"),
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");

    await flow.chooseDropdown(
      "clientAuthMethod",
      "Private key (private_key_jwt)",
    );

    // Auth0 stores the public key itself, so there is nothing to certify
    await expect(page.locator("#certificatePem")).toHaveCount(0);
    await expect(page.locator("#thumbprintSha1")).toHaveCount(0);

    await expect(flow.nextButton()).toBeDisabled();

    await page.getByRole("button", { name: "Generate Key Pair" }).click();
    await expect(page.locator("#privateKeyPem")).not.toHaveValue("", {
      timeout: KEY_PAIR_TIMEOUT,
    });

    // a key alone is not enough: Auth0 needs to be told which credential it is
    await expect(flow.nextButton()).toBeDisabled();

    await flow.fill("clientAssertionKid", "gsQ2Ny1demoCredentialKid7pLzR");
    await expect(flow.nextButton()).toBeEnabled();
  });
});

test.describe("Sending a token request that cannot be sent", () => {
  test("says which credential is missing instead of doing nothing", async ({
    page,
  }) => {
    // The Send button is enabled whenever a request preview exists, and the
    // preview is built with an empty client_secret. Pressing it used to hit a
    // bare `return`: no spinner, no error, no response, and no clue which of
    // seven preconditions stopped it.
    //
    // Next will not carry you past Authentication without a secret, so the way
    // in is to reach Tokens with one and then clear it — the step headers stay
    // clickable once a step has been completed.
    await seedSettings(page, "auth0", {
      clientCredentials: defaultsFor("auth0"),
    });

    const flow = new FlowPage(page, "auth0", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");
    await flow.fill("clientSecret", "demo-client-secret");
    await flow.next();
    await flow.expectStep("Tokens");

    await flow.previous();
    await flow.expectStep("Authentication");
    await flow.fill("clientSecret", "");
    await expect(flow.nextButton()).toBeDisabled();

    await page.locator(".p-steps-item", { hasText: "Tokens" }).first().click();
    await flow.expectStep("Tokens");

    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled();
    await send.click();

    await expect(page.getByTestId("tokenExchangeBlocked")).toHaveText(
      /client secret/i,
    );
    await expect(page.locator("#tokenResponse")).toHaveValue("");
  });
});

test.describe("Entra client authentication", () => {
  test("still requires a certificate and its thumbprint", async ({ page }) => {
    await seedSettings(page, "entra", {
      clientCredentials: defaultsFor("entra"),
    });

    const flow = new FlowPage(page, "entra", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");

    await flow.chooseDropdown(
      "clientAuthMethod",
      "Certificate (private_key_jwt)",
    );

    await expect(page.locator("#certificatePem")).toBeVisible();
    await expect(page.locator("#thumbprintSha1")).toBeVisible();

    await page.getByRole("button", { name: "Generate Key Pair" }).click();
    await expect(page.locator("#privateKeyPem")).not.toHaveValue("", {
      timeout: KEY_PAIR_TIMEOUT,
    });

    // a key pair without a certificate leaves Entra with no x5t to match
    await expect(flow.nextButton()).toBeDisabled();

    await page.getByRole("button", { name: "Generate Certificate" }).click();
    await expect(page.locator("#thumbprintSha1")).not.toHaveValue("", {
      timeout: KEY_PAIR_TIMEOUT,
    });

    await expect(flow.nextButton()).toBeEnabled();
  });
});
