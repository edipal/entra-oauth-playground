import { expect, type Locator, type Page } from "@playwright/test";
import type { ProviderId } from "./settings";

export type FlowRoute =
  | "authorization-code/public-client"
  | "authorization-code/confidential-client"
  | "client-credentials";

export type StepName =
  | "Overview"
  | "Settings"
  | "PKCE"
  | "Authorize"
  | "Callback"
  | "Authentication"
  | "Tokens"
  | "Decode"
  | "Validate"
  | "Call API";

/** Drives the step wizard shared by every flow page. */
export class FlowPage {
  constructor(
    readonly page: Page,
    readonly providerId: ProviderId,
    readonly route: FlowRoute,
  ) {}

  get url() {
    return `/en/${this.providerId}/${this.route}`;
  }

  async goto() {
    await this.page.goto(this.url);
    await expect(this.stepHeader).toBeVisible();
  }

  get stepHeader(): Locator {
    return this.page.locator(".p-steps-item.p-highlight");
  }

  async currentStep(): Promise<string> {
    // rendered as "2Settings" - the index prefix is a separate span
    const text = (await this.stepHeader.innerText()).trim();
    return text.replace(/^\d+/, "").trim();
  }

  async expectStep(name: StepName) {
    await expect
      .poll(() => this.currentStep(), { timeout: 15_000 })
      .toBe(name === "Call API" ? "Call API" : name);
  }

  next() {
    return this.nextButton().click();
  }

  previous() {
    return this.page
      .getByRole("button", { name: "Previous", exact: true })
      .click();
  }

  // exact: the Next.js dev-tools button also has "Next" in its accessible name
  nextButton(): Locator {
    return this.page.getByRole("button", { name: "Next", exact: true });
  }

  /** Walks forward until the named step is active, generating PKCE on the way. */
  async advanceTo(target: StepName) {
    for (let guard = 0; guard < 12; guard += 1) {
      if ((await this.currentStep()) === target) return;

      if ((await this.currentStep()) === "PKCE") {
        const generate = this.page.getByRole("button", {
          name: "Generate",
          exact: true,
        });
        if (await generate.isVisible().catch(() => false)) {
          if (!(await this.codeVerifier.inputValue())) await generate.click();
        }
      }

      await expect(this.nextButton()).toBeEnabled();
      await this.next();
      await this.page.waitForTimeout(150);
    }

    throw new Error(`never reached step ${target}`);
  }

  get codeVerifier(): Locator {
    return this.page.locator("#codeVerifier");
  }

  get codeChallenge(): Locator {
    return this.page.locator("#codeChallenge");
  }

  get authUrlPreview(): Locator {
    return this.page.locator("#authUrlPreview");
  }

  /** The authorization URL the app would open, parsed. */
  async authorizeUrl(): Promise<URL> {
    const raw = await this.authUrlPreview.inputValue();
    expect(raw, "authorization URL preview should not be empty").not.toBe("");
    return new URL(raw);
  }

  async authorizeParams(): Promise<Record<string, string>> {
    return Object.fromEntries((await this.authorizeUrl()).searchParams);
  }

  select(id: string) {
    return this.page.locator(`#${id}`);
  }

  /**
   * The clickable root of a PrimeReact dropdown.
   *
   * The controls carry `inputId`, not `id`, so the label's `htmlFor` reaches a
   * real focusable element. That puts the id on an `<input readonly>` sitting
   * *under* the visible `.p-dropdown-label`, which intercepts the click — so a
   * spec has to drive the wrapper, not the element carrying the id.
   */
  dropdown(id: string): Locator {
    return this.page.locator(`.p-dropdown:has(#${id})`);
  }

  /** PrimeReact dropdowns are not native selects: open, then pick by label. */
  async chooseDropdown(id: string, optionLabel: string) {
    await this.dropdown(id).click();
    await this.page
      .locator(".p-dropdown-panel .p-dropdown-item", { hasText: optionLabel })
      .first()
      .click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Fills by id directly. This used to fall back to the first editable
   * descendant, because PrimeReact controls given `id` put it on a wrapper div —
   * which also meant the label's `htmlFor` pointed at something unfocusable.
   * Those controls carry `inputId` now, so every id here reaches a real field.
   * The fallback is deliberately gone: if one is reintroduced, this fails with
   * "Element is not an <input>" rather than quietly compensating for it.
   */
  fill(id: string, value: string) {
    return this.page.locator(`#${id}`).fill(value);
  }
}
