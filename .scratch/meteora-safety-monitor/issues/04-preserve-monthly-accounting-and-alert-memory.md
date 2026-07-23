# Preserve monthly accounting and alert memory

**Blocked by:** 01 — Prove the honest financial report.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Persist the small amount of state needed for month-to-date accounting and useful alerts. The monitor must survive stateless scheduled runners without committing state after every healthy hourly check.

## Acceptance criteria

- [ ] The first successful run of a UTC month creates a monthly fee and PnL baseline.
- [ ] Month-to-date fee revenue and PnL are calculated as deltas from that baseline.
- [ ] One durable daily snapshot can be recorded for trend inspection.
- [ ] Identical green reports are suppressed outside the daily heartbeat.
- [ ] Danger states are rate-limited but receive periodic reminders.
- [ ] A return to green after danger produces a recovery report.
- [ ] A position-address change requires an explicit rollover command and preserves cumulative strategy context.
- [ ] Corrupt or missing required state fails safe rather than silently resetting financial history.
