# Your Meteora JUP-SOL launch checklist

The build is read-only. You keep full control of the wallet and sign every
swap, deposit, claim, rebalance, and withdrawal yourself.

## Locked position plan

- Wallet now: 20.38 SOL.
- Wallet reserve after all entry costs: at least 0.50 SOL.
- Maximum total strategy spend: 19.88 SOL-equivalent.
- Pool: JUP-SOL BS80,
  `C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`.
- Shape: one Spot position, 30 bins, centered on the active bin.
- Delivery: Telegram.
- Main score: monthly net PnL in USD.
- Safety rule: loss and bad data override fee revenue.

## Your order of operations

1. Create a Telegram bot with `@BotFather`.
2. Message the bot once.
3. Find the chat ID with `npm run report -- telegram-chat-id`.
4. Put the token and chat ID in private GitHub Actions secrets.
5. Run the `delivery-test` workflow and see it on your phone.
6. Open only the approved Meteora pool.
7. Choose Spot, exactly 30 bins, centered on the active bin.
8. Use the live quote for the JUP/SOL mix. Do not pre-swap a guessed percent.
9. Reduce the deposit until the final wallet preview leaves at least 0.50 SOL.
10. Review slippage, fees, token amounts, range, and remaining SOL.
11. Sign the entry yourself.
12. Record the public position address, entry bin, actual deployed SOL and
    USD, and entry costs.
13. Add those public values as private-repository Actions variables.
14. Run `dry-run` and compare every number with Meteora.
15. Run `run` once. Confirm Telegram matches.
16. Let the hourly monitor take over reporting.

## Phone response

- `GREEN`: read it; do nothing.
- `YELLOW`: inspect; prepare; do not trade from one reading.
- `RED`: inspect now; prepare manual risk reduction; do not add capital.
- `CRITICAL`: stop adding; protect remaining capital first.
- `DATA_FAILURE`: distrust the report numbers and inspect Meteora manually.

The detailed guide is in
`docs/ELI5-OPERATING-GUIDE.md` in the private repository.

Monitoring can shorten response time. It cannot guarantee against loss.
