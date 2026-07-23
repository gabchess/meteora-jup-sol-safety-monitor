# Meteora JUP-SOL Safety Monitor

## Destination

A tested, deployable monitor for one manually operated 30-bin Spot-Spread position in Meteora's JUP-SOL BS80 pool. It reports monthly USD fee revenue and net PnL, warns before the position reaches a loss-prone state, delivers alerts to Telegram with email as a fallback, and has no wallet authority.

## Notes

- Capital plan: retain 0.50 SOL as an operating reserve and allocate up to 19.88 SOL-equivalent to the position.
- Position creation, rebalancing, claiming, and closing remain manual mobile-wallet actions.
- The monitor is advisory. It cannot guarantee that losses will not occur.
- The local Markdown tracker is used because this workspace has no configured issue tracker or remote repository.

## Decisions so far

- Use the JUP-SOL BS80 pool at `C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`.
- Use one centered 30-bin Spot-Spread position.
- Measure the primary objective in USD.
- Separate gross fee revenue, net PnL, and performance versus holding SOL.
- Check hourly and deliver actionable phone alerts through Telegram.
- Use email only as a delivery fallback.
- Use a deterministic monitor instead of paying an LLM to interpret every check.
- Keep all wallet authority out of the monitor.

## Not yet specified

- The wallet public address, position address, Telegram bot token, Telegram chat id, and optional email credentials will be supplied during deployment.
- Final entry token composition and price bounds will come from Meteora's unsigned position quote.

## Out of scope

- Automated swaps, rebalances, fee claims, or position closure.
- Custody of seed phrases, private keys, or transaction-signing authority.
- A guarantee against market, smart-contract, oracle, API, or network losses.
- Telegram or email commands that can trigger financial actions.
