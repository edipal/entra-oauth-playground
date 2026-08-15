import { expect, type Page } from "@playwright/test";
import type { FlowPage } from "./flow";

// Steps shared by every authorization-code round trip. The provider-specific
// assertions stay in the specs; only the wizard driving lives here.

/**
 * Generates state and nonce on the Authorize step, then returns the parameters the
 * app would actually send. State guards the callback against CSRF and nonce binds
 * the ID token to this request, so both are asserted on the way back.
 */
export async function prepareAuthorizeRequest(flow: FlowPage) {
  const generate = flow.page.getByRole("button", {
    name: "Generate",
    exact: true,
  });
  await generate.nth(0).click();
  await generate.nth(1).click();

  return flow.authorizeParams();
}

/** Asserts the code came back and that the state is the one we sent. */
export async function expectCallbackFor(flow: FlowPage, sentState: string) {
  await flow.expectStep("Callback");
  await expect(flow.page.locator("#authCode")).not.toHaveValue("", {
    timeout: 20_000,
  });
  expect(await flow.page.locator("#extractedState").inputValue()).toBe(
    sentState,
  );
}

/** Sends the token request from the Tokens step and returns the raw response. */
export async function sendTokenRequest(page: Page) {
  await page.getByRole("button", { name: "Send", exact: true }).click();

  const tokenResponse = page.locator("#tokenResponse");
  await expect(tokenResponse).not.toHaveValue("", { timeout: 30_000 });
  return tokenResponse.inputValue();
}

/** Runs the Decode step and returns both decoded payloads. */
export async function decodeTokens(flow: FlowPage) {
  await flow.next();
  await flow.expectStep("Decode");
  await flow.page.getByRole("button", { name: "Decode", exact: true }).click();

  const accessPayload = flow.page.locator("#accessPayload");
  await expect(accessPayload).not.toHaveValue("", { timeout: 10_000 });

  return {
    access: JSON.parse(await accessPayload.inputValue()),
    id: JSON.parse(await flow.page.locator("#idPayload").inputValue()),
  };
}

/** Walks Validate then Call API, returning what the API answered. */
export async function validateAndCallApi(flow: FlowPage) {
  await flow.next();
  await flow.expectStep("Validate");

  await flow.next();
  await flow.expectStep("Call API");
  await flow.page
    .getByRole("button", { name: "Send GET", exact: true })
    .click();

  const apiResponse = flow.page.locator("#apiResponse");
  await expect(apiResponse).not.toHaveValue("", { timeout: 30_000 });
  return apiResponse.inputValue();
}
