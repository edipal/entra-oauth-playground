import { type Page } from "@playwright/test";
import { expect, test } from "./support/offlineTest";
import { FlowPage } from "./support/flow";
import { defaultsFor, seedSettings } from "./support/settings";

// Every labelled control must have a label that reaches it.
//
// LabelWithHelp renders `<label htmlFor={id}>`, which works for InputText and
// InputTextarea because they put `id` on the element itself. PrimeReact's
// Password and Dropdown put `id` on a wrapper <div> and expose `inputId` for the
// field — so a control given `id` ended up with a label pointing at something
// that cannot take focus, and a screen reader announcing it unlabelled.
//
// Clicking the label is the assertion: it only moves focus when `htmlFor`
// resolves to a labelable element.

async function expectLabelFocusesControl(page: Page, id: string) {
  const label = page.locator(`label[for="${id}"]`);
  await expect(label, `no label points at #${id}`).toHaveCount(1);

  // A labelable element, not a wrapper: <div> is what the bug produced.
  const tagName = await page
    .locator(`#${id}`)
    .evaluate((element) => element.tagName.toLowerCase());
  expect(["input", "textarea", "select"], `#${id} is a <${tagName}>`).toContain(
    tagName,
  );

  await label.click();
  await expect(page.locator(`#${id}`)).toBeFocused();
}

test.describe("Labels reach the control they name", () => {
  test("on the Entra authorize step", async ({ page }) => {
    await seedSettings(page, "entra", {
      authCodeConfidentialClient: defaultsFor("entra"),
    });

    const flow = new FlowPage(
      page,
      "entra",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    // both are PrimeReact Dropdowns
    await expectLabelFocusesControl(page, "responseMode");
    await expectLabelFocusesControl(page, "prompt");
  });

  test("on the client-authentication step", async ({ page }) => {
    await seedSettings(page, "entra", {
      clientCredentials: defaultsFor("entra"),
    });

    const flow = new FlowPage(page, "entra", "client-credentials");
    await flow.goto();
    await flow.advanceTo("Authentication");

    // a Dropdown and a Password, the two components that hide the id
    await expectLabelFocusesControl(page, "clientAuthMethod");
    await expectLabelFocusesControl(page, "clientSecret");
  });

  test("on the Auth0 authorize step", async ({ page }) => {
    await seedSettings(page, "auth0", {
      authCodeConfidentialClient: defaultsFor("auth0", {
        authRequestMode: "par",
      }),
    });

    const flow = new FlowPage(
      page,
      "auth0",
      "authorization-code/confidential-client",
    );
    await flow.goto();
    await flow.advanceTo("Authorize");

    await expectLabelFocusesControl(page, "auth0RequestMode");
    await expectLabelFocusesControl(page, "auth0ClientAuthMethod");
    await expectLabelFocusesControl(page, "auth0ScreenHint");
    // the PAR client secret, which is a Password and was right from the start
    await expectLabelFocusesControl(page, "auth0ParClientSecret");
    // and an ordinary InputText, to prove the check is not vacuous
    await expectLabelFocusesControl(page, "auth0Connection");
  });
});
