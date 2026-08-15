import { expect, type Locator, type Page } from "@playwright/test";
import { auth0, entra } from "./credentials";

// Drives the identity provider's own sign-in pages. These selectors belong to
// Microsoft and Auth0, not to this app, so they are the most likely thing to need
// adjusting after a provider redesign — which is why every spec goes through here.

/**
 * Clicks "Open popup" on the Authorize step, signs in inside the popup, and waits
 * for the app to receive the authorization code via postMessage.
 */
export async function authorizeThroughPopup(
  page: Page,
  provider: "entra" | "auth0",
  // The private_key_jwt specs may run against a different Auth0 tenant, with its
  // own user, so the sign-in credentials are overridable.
  user?: { username: string; password: string },
) {
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Open popup" }).click(),
  ]);

  // The app opens the window blank and assigns location afterwards, so wait for
  // the navigation to the provider rather than for the initial about:blank load.
  await popup.waitForURL(
    provider === "entra"
      ? /login\.microsoftonline\.com/
      : /auth0\.com|\/u\/login/,
    { timeout: 30_000 },
  );
  await popup.waitForLoadState("domcontentloaded");

  if (provider === "entra") {
    await signInToEntra(popup);
  } else {
    await signInToAuth0(popup, user || auth0);
  }

  // The callback page posts the code to the opener and closes itself. Poll for
  // that rather than awaiting the close event: the popup has usually closed
  // before this line runs, and a one-shot event that already fired never fires
  // again — which burned 60s and let Entra's short-lived code expire.
  await expect
    .poll(() => popup.isClosed(), { timeout: 15_000 })
    .toBe(true)
    .catch(() => undefined);
}

async function signInToEntra(popup: Page) {
  const email = popup.locator('input[type="email"], input[name="loginfmt"]');
  await settle(popup);
  if (await email.isVisible().catch(() => false)) {
    await fillReliably(popup, email, entra.username, "username");
    await submitEntraPage(popup);
  }

  // A request Entra rejects outright — an SPA client without PKCE, say — is
  // redirected back to the callback without ever asking for a password.
  if (hasLeftSignIn(popup)) return;

  const password = popup.locator(
    'input[name="passwd"], input[type="password"]',
  );
  await expect(password.first()).toBeVisible({ timeout: 30_000 });
  await settle(popup);
  await fillReliably(popup, password.first(), entra.password, "password");
  await submitEntraPage(popup);

  await failOnEntraError(popup);

  // "Stay signed in?" appears for some tenants. Answer No so the test does not
  // leave a persistent session cookie behind.
  const staySignedIn = popup.locator("#idBtn_Back");
  if (await staySignedIn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await staySignedIn.click();
  }

  await acceptConsentIfShown(popup);
}

/** True once the popup has left the provider's sign-in pages, or has closed. */
function hasLeftSignIn(popup: Page) {
  return popup.isClosed() || !/login\.microsoftonline\.com/.test(popup.url());
}

/**
 * Microsoft's sign-in page renders its markup before its scripts have bound the
 * form. Submitting in that window posts an empty field and comes back with
 * "Enter a valid email address", so wait for the page to go quiet first.
 */
async function settle(popup: Page) {
  await popup.waitForLoadState("networkidle").catch(() => undefined);
  await popup.waitForTimeout(750);
}

/**
 * Belt and braces for the same race: fill, confirm the value survived the next
 * render, and retry if the page discarded it.
 */
async function fillReliably(
  popup: Page,
  field: Locator,
  value: string,
  label: string,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await field.fill(value);
    await popup.waitForTimeout(300);
    if ((await field.inputValue()) === value) return;
  }

  throw new Error(`the ${label} field kept discarding its value`);
}

/**
 * Every step of the Entra sign-in wizard submits through the same primary
 * button. It is an `input[type=submit]`, so its accessible name changes with the
 * step ("Next", then "Sign in") — the stable id is what to target.
 */
async function submitEntraPage(popup: Page) {
  await popup
    .locator('#idSIButton9, input[type="submit"], button[type="submit"]')
    .first()
    .click();
}

/** Surfaces Microsoft's own message rather than timing out further downstream. */
async function failOnEntraError(popup: Page) {
  const error = popup.locator(
    '#passwordError, #usernameError, [role="alert"]:visible',
  );

  if (
    await error
      .first()
      .isVisible({ timeout: 4_000 })
      .catch(() => false)
  ) {
    const text = (await error.first().innerText()).trim();
    throw new Error(
      `Entra rejected the sign-in: "${text}". Check E2E_ENTRA_USERNAME / ` +
        `E2E_ENTRA_PASSWORD, and that the account has no MFA or Conditional ` +
        `Access requirement.`,
    );
  }
}

async function signInToAuth0(
  popup: Page,
  user: { username: string; password: string },
) {
  const username = popup.locator(
    'input[name="username"], input[name="email"], input[type="email"]',
  );
  if (await username.isVisible().catch(() => false)) {
    await username.fill(user.username);
  }

  const password = popup.locator(
    'input[name="password"], input[type="password"]',
  );
  if (!(await password.isVisible().catch(() => false))) {
    // identifier-first: submit the username, then the password appears
    await popup
      .getByRole("button", { name: /continue|next/i })
      .first()
      .click();
    await expect(password).toBeVisible({ timeout: 30_000 });
  }

  await password.fill(user.password);
  expect(
    await password.inputValue(),
    "password field did not accept the value",
  ).not.toBe("");

  await popup
    .getByRole("button", { name: /continue|log in|sign in/i })
    .first()
    .click();

  await failOnAuth0Error(popup);
  await acceptConsentIfShown(popup);
}

/**
 * Surfaces Auth0's own message instead of letting the spec time out later on an
 * unrelated assertion.
 */
async function failOnAuth0Error(popup: Page) {
  const error = popup.locator(
    '[role="alert"], .ulp-input-error-message, #error-element-password, #error-element-username',
  );

  if (
    await error
      .first()
      .isVisible({ timeout: 4_000 })
      .catch(() => false)
  ) {
    const text = (await error.first().innerText()).trim();
    throw new Error(
      `Auth0 rejected the sign-in: "${text}". Check E2E_AUTH0_USERNAME / ` +
        `E2E_AUTH0_PASSWORD, and that the test user's database connection is ` +
        `the one enabled on this application.`,
    );
  }
}

async function acceptConsentIfShown(popup: Page) {
  const accept = popup.getByRole("button", {
    name: /accept|allow|consent|authorize|yes/i,
  });

  if (
    await accept
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)
  ) {
    await accept.first().click();
  }
}
