import { expect, test as base } from "@playwright/test";
import { stubAuth0Discovery } from "./stubProvider";

// The `test` every browser-based offline spec imports instead of Playwright's.
//
// "Offline" was aspirational: Auth0 answers discovery for any subdomain, so a
// spec that forgot to stub it still passed — by resolving its endpoints over the
// internet. That works on a developer's machine and fails on a plane, behind a
// proxy, or on a CI runner with no egress, and it fails as "Next is disabled"
// rather than as anything mentioning the network.
//
// So the guard below does two things: it stubs discovery for every spec, and it
// blocks anything else that leaves the machine, failing the test by name. Both
// hang off one auto fixture, which means a new spec is hermetic by default and
// cannot opt out by forgetting.

/** Hosts the app itself is served from; everything else is the outside world. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const test = base.extend<{ hermetic: void }>({
  hermetic: [
    async ({ page }, use) => {
      const escaped: string[] = [];

      // Registered first, so it is the last handler consulted: every stub a spec
      // adds later takes precedence, and only genuinely unstubbed traffic lands
      // here. Page-level routes are checked before context-level ones either way.
      await page.context().route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (LOCAL_HOSTS.has(url.hostname)) return route.fallback();
        escaped.push(`${url.origin}${url.pathname}`);
        return route.abort("blockedbyclient");
      });

      await stubAuth0Discovery(page);

      await use();

      expect(
        [...new Set(escaped)],
        "an offline spec reached the network — stub it in support/stubProvider.ts",
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
