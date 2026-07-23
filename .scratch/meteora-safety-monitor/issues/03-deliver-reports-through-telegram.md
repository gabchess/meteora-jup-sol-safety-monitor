# Deliver reports through Telegram

**Blocked by:** 01 — Prove the honest financial report; 02 — Produce a live Meteora dry run.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Deliver the canonical report through Telegram's Bot API. Provide an explicit delivery-test command before any live schedule is enabled. Failed or rejected deliveries must fail visibly.

## Acceptance criteria

- [ ] Telegram credentials are read only from environment variables.
- [ ] The application validates Bot API responses rather than trusting HTTP status alone.
- [ ] Rejection, timeout, malformed response, and network failure produce non-zero command results without leaking secrets.
- [ ] The delivery-test message is clearly labelled as a test and contains no financial recommendation.
- [ ] Live delivery sends the canonical report text produced by the acceptance seam.
- [ ] Unit and contract tests use a fake Telegram endpoint; routine tests never send real messages.
