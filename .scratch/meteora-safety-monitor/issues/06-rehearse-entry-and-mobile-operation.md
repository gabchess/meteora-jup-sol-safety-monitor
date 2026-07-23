# Rehearse entry and mobile operation

**Blocked by:** 05 — Run the monitor hourly.

**Status:** ready-for-agent

## Parent

[Spec: Meteora JUP-SOL safety monitor](https://github.com/gabchess/meteora-jup-sol-safety-monitor/issues/1)

## What to build

Provide the ELI5 operating guide that hands every financial action to Gabe. Rehearse the path from a Telegram alert to manual inspection in a mobile wallet, and define the checks that must pass before the 19.88 SOL-equivalent position is created.

## Acceptance criteria

- [ ] The guide preserves a 0.50 SOL operating reserve and forbids depositing the full wallet balance.
- [ ] The entry checklist requires inspection of the current active bin, exact 30-bin bounds, token composition, slippage, fees, and unsigned transaction before signing.
- [ ] The guide tells Gabe not to pre-swap a fixed percentage into JUP before the final Meteora quote.
- [ ] Green, yellow, red, critical, and data-failure states each map to one short mobile checklist.
- [ ] The first live report is reconciled manually with the Meteora UI before the monitor is trusted.
- [ ] The Telegram-to-mobile-wallet path is rehearsed with a test report and no live transaction.
- [ ] Seed phrases, private keys, signing requests, deposits, swaps, rebalances, claims, and withdrawals remain human-only steps.
- [ ] The guide states that monitoring reduces response time but cannot guarantee against financial loss.
