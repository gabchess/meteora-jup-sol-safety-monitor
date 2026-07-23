# Prove the honest financial report

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Create the end-to-end acceptance seam for the monitor. Given saved Meteora data, prior state, configuration, and a clock, it must produce the canonical financial report, safety state, recommended human action, next durable state, delivery decision, and Telegram-ready text.

The report must keep fee revenue, net PnL, return on deployed capital, and performance versus holding SOL separate. A positive fee result must never hide a negative net result.

## Acceptance criteria

- [ ] A fixture command produces a complete report without network access.
- [ ] The report separates fee revenue, net PnL, return percentage, and HODL comparison.
- [ ] The state precedence is `DATA_FAILURE`, `CRITICAL`, `RED`, `YELLOW`, then `GREEN`.
- [ ] Healthy, losing, out-of-range, stale, malformed, accounting-mismatch, and HODL-underperformance scenarios are covered.
- [ ] Positive fees with negative net PnL is reported as a loss.
- [ ] Tests assert public output and behavior rather than private helper calls.
- [ ] The implementation contains no wallet, signer, or transaction-building capability.
