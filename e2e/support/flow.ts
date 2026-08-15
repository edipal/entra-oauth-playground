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

  /** PrimeReact dropdowns are not native selects: open, then pick by label. */
  async chooseDropdown(id: string, optionLabel: string) {
    await this.page.locator(`#${id}`).click();
    await this.page
      .locator(".p-dropdown-panel .p-dropdown-item", { hasText: optionLabel })
      .first()
      .click();
    await this.page.waitForTimeout(100);
  }

  /**
   * Some PrimeReact controls (Password) put the id on a wrapper element rather
   * than on the field, so fall back to the first editable descendant.
   */
  async fill(id: string, value: string) {
    const root = this.page.locator(`#${id}`);
    const tag = await root.evaluate((el) => el.tagName.toLowerCase());
    const target =
      tag === "input" || tag === "textarea"
        ? root
        : root.locator("input, textarea").first();

    await target.fill(value);
  }
}
