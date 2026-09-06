import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// Reports what the live suite actually exercised.
//
// Every live spec calls `requires()`, which skips itself when its credentials are
// absent. On a machine with no .env.e2e.local that is all of them — and Playwright
// exits 0, so `pnpm e2e` reports success having contacted no provider at all. The
// tally below makes that visible.
//
// Enforcement does NOT live here. `requires()` itself throws under
// E2E_REQUIRE_LIVE=1, because a `--reporter=` argument replaces the reporter list
// from playwright.config.ts and would drop this file — and with it any guard it
// held — without a word. The check below is the second net, for the case where
// something skips a live spec without going through `requires()`.

const LIVE_PROJECT = "live";

type Skip = { title: string; reason: string };

/** The `missing credentials: …` text `requires()` puts on the skip. */
function skipReason(test: TestCase, result: TestResult): string {
  const annotations = [
    ...((result as { annotations?: { type: string; description?: string }[] })
      .annotations ?? []),
    ...test.annotations,
  ];

  const skip = annotations.find(
    (annotation) => annotation.type === "skip" && annotation.description,
  );
  return skip?.description ?? "skipped";
}

export default class LiveSummaryReporter implements Reporter {
  private readonly skipped: Skip[] = [];
  private ran = 0;

  onTestEnd(test: TestCase, result: TestResult) {
    if (test.parent.project()?.name !== LIVE_PROJECT) return;

    if (result.status === "skipped") {
      this.skipped.push({
        title: test.title,
        reason: skipReason(test, result),
      });
      return;
    }
    this.ran += 1;
  }

  async onEnd(result: FullResult) {
    const total = this.ran + this.skipped.length;
    if (total === 0) return undefined;

    const lines = [
      "",
      `Live suite: ${this.ran} of ${total} ran, ${this.skipped.length} skipped.`,
    ];

    // Group by reason: one missing credential usually takes several specs with it.
    const byReason = new Map<string, string[]>();
    for (const skip of this.skipped) {
      byReason.set(skip.reason, [
        ...(byReason.get(skip.reason) ?? []),
        skip.title,
      ]);
    }
    for (const [reason, titles] of byReason) {
      lines.push(`  ${titles.length}x ${reason}`);
    }

    if (this.ran === 0) {
      lines.push(
        "  Nothing ran against a real tenant. Copy .env.e2e.example to",
        "  .env.e2e.local and fill it in, or accept this run as offline-only.",
      );
    }

    console.log(lines.join("\n"));

    // Opt-in, because running the live suite without credentials is a normal
    // thing to do locally. A CI job that means to exercise a tenant sets this.
    if (this.ran === 0 && process.env.E2E_REQUIRE_LIVE === "1") {
      console.log(
        "  E2E_REQUIRE_LIVE=1 is set, so a live run that exercised nothing fails.",
      );
      return { status: "failed" as const };
    }

    return { status: result.status };
  }
}
