import { test } from "@playwright/test";

// Next.js dev compiles each route the first time it is requested. Without this,
// the opening wave of parallel specs races that compiler and trips the navigation
// timeout — which looks exactly like a broken test but is only a cold server.
// Visiting every route once, sequentially, costs a few seconds and makes the rest
// of the suite deterministic. Both projects depend on this one.

const ROUTES = [
  "/en/entra",
  "/en/auth0",
  "/en/entra/authorization-code/public-client",
  "/en/entra/authorization-code/confidential-client",
  "/en/entra/client-credentials",
  "/en/auth0/authorization-code/public-client",
  "/en/auth0/authorization-code/confidential-client",
  "/en/auth0/client-credentials",
];

test("warm up the dev server routes", async ({ page }) => {
  test.setTimeout(300_000);

  for (const route of ROUTES) {
    await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
  }
});
