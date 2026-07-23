# Produce a live Meteora dry run

**Blocked by:** 01 — Prove the honest financial report.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Connect the tested monitor seam to Meteora's public pool and position-PnL APIs. A user must be able to provide only public configuration and print a live report without sending a notification or making a financial action.

## Acceptance criteria

- [ ] Configuration requires the expected JUP-SOL pool, wallet public address, position address, initial deployed SOL equivalent, and cost inputs.
- [ ] API requests have explicit timeouts and actionable errors.
- [ ] Numeric strings, position identity, pool identity, freshness, and required fields are validated before evaluation.
- [ ] The configured position must be open and belong to the configured wallet and pool.
- [ ] Live dry-run mode prints the canonical report and never delivers it.
- [ ] Missing, stale, malformed, inconsistent, or unavailable data produces `DATA_FAILURE`.
- [ ] Tests use injected HTTP responses or a local test server and never depend on mainnet availability.
