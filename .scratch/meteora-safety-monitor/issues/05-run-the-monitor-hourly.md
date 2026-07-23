# Run the monitor hourly

**Blocked by:** 02 — Produce a live Meteora dry run; 03 — Deliver reports through Telegram; 04 — Preserve monthly accounting and alert memory.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Run the tested monitor in a private GitHub repository on an hourly GitHub Actions schedule, with a daily heartbeat and durable state updates. Provide a manual dry-run workflow and make failures visible without granting wallet authority.

## Acceptance criteria

- [ ] The workflow runs hourly away from the top of the hour.
- [ ] A manual workflow supports dry-run and forced Telegram delivery-test modes.
- [ ] The workflow uses the minimum repository permissions required for tests, monitoring, and approved state-file updates.
- [ ] Overlapping monitor jobs are prevented.
- [ ] Secret values are masked and never written to logs, reports, artifacts, or state.
- [ ] Only approved monitor-state paths can be committed by the workflow.
- [ ] State commits skip recursive workflow execution.
- [ ] Tests and static checks run before the live monitor command.
- [ ] The expected monthly runtime remains within GitHub Free's included private-repository allowance.
