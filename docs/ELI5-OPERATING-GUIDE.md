# ELI5 Setup and Phone Playbook

## The plan in one minute

You have 20.38 SOL. We are using the full strategy budget, not the full wallet.

- At least 0.50 SOL stays outside the position.
- Up to 19.88 SOL-equivalent pays for the position and its entry costs.
- The position uses JUP-SOL BS80.
- It uses one Spot range with 30 bins.
- The range starts centered on the live price.
- Telegram watches. You act.

Think of the 0.50 SOL as untouchable operating cash. If the final wallet
preview would leave 0.49 SOL, make the deposit smaller. Do not deposit 19.88
blindly and discover that fees used part of the reserve.

This plan aims to make monthly USD profit. It cannot make loss impossible.
JUP and SOL can fall, the position can underperform holding SOL, contracts and
APIs can fail, and a narrow range can go out of range.

## Safety boundary

The code may:

- Read your public wallet and position addresses.
- Read Meteora's public pool and PnL data.
- Calculate a report.
- Send that report to Telegram.

Only you may:

- Enter a seed phrase or private key.
- Connect the wallet.
- Approve a swap.
- Deposit liquidity.
- Sign a transaction.
- Claim fees.
- Rebalance, withdraw, or close.

Never put a seed phrase, private key, wallet export, or signing link in GitHub,
Telegram, this repository, or a chat with an AI.

## Phase 1: make Telegram work before depositing

### 1. Create the bot

1. Open Telegram on your phone.
2. Open the verified `@BotFather` chat.
3. Send `/newbot`.
4. Follow its prompts for a name and username.
5. Copy the bot token somewhere temporary and private.
6. Open your new bot, press **Start**, and send `hello`.

The token can send messages as the bot. Do not paste it into this chat or
commit it to a file.

### 2. Find your chat ID without putting the token in browser history

In the repository terminal, run:

```zsh
read -s "TELEGRAM_BOT_TOKEN?Paste bot token, then press Enter: "
export TELEGRAM_BOT_TOKEN
npm run report -- telegram-chat-id
unset TELEGRAM_BOT_TOKEN
```

The command prints a line such as `Chat ID: 123456789`. It does not print the
bot token.

### 3. Save the Telegram values in private GitHub secrets

1. Open the private repository on GitHub.
2. Go to **Settings → Secrets and variables → Actions**.
3. Under **Secrets**, create `TELEGRAM_BOT_TOKEN`.
4. Paste the token as its value.
5. Create `TELEGRAM_CHAT_ID`.
6. Paste the chat ID as its value.
7. Do not create a secret for any wallet key. The workflow does not need one.

### 4. Prove delivery

After the monitor branch is merged:

1. Open **Actions → Meteora safety monitor**.
2. Tap **Run workflow**.
3. Choose `delivery-test`.
4. Run it.
5. Confirm that your phone receives a message labelled `DELIVERY TEST`.

Do not fund the position until this message arrives.

## Phase 2: create the position yourself

Do this slowly. The website may change its button names, but the checks do not
change.

### 1. Protect the reserve

Before opening Meteora:

1. Confirm the wallet shows 20.38 SOL.
2. Write down the hard floor: `0.50 SOL`.
3. Remember that 19.88 SOL-equivalent is a ceiling, not a required input.
4. Include swap cost, slippage, and Solana fees inside that ceiling.

### 2. Open only the approved pool

Use the official page:

`https://app.meteora.ag/dlmm/C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`

Before connecting the wallet, compare every character of the pool address:

`C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`

Confirm the page says:

- Pair: JUP-SOL.
- Bin step: 80, often shown as BS80.
- Pool address: the exact address above.

If one item differs, stop.

### 3. Connect the mobile wallet

Use your wallet's in-app browser or its normal connection flow. Never enter a
seed phrase into the Meteora website. A normal connection asks the wallet to
approve a connection, then later asks it to preview and sign a transaction.

### 4. Build the range

1. Choose **Add Liquidity**.
2. Choose the **Spot** distribution.
3. Set exactly 30 bins.
4. Center the range on the current active bin.
5. Record:
   - Active bin at entry.
   - Lower bin.
   - Upper bin.
6. Check the arithmetic: `upper bin - lower bin + 1 = 30`.
7. Confirm the active bin sits near the middle of the two bounds.

If the UI shows prices instead of bin IDs, use its 30-bin range control and
record the bin IDs from the created position before enabling the monitor.

### 5. Let the final quote determine the token mix

Do not swap a fixed 50% or another guessed percentage into JUP first.

The exact JUP/SOL mix depends on the live active bin and the chosen bounds. Use
Meteora's final deposit or zap quote if offered. If the UI requires a separate
swap, use the amounts from that live quote. If you cannot see the final
amounts, stop instead of guessing.

Before signing, check:

- SOL going into the strategy.
- JUP received or deposited.
- Slippage setting and minimum received.
- Meteora fee and network fee.
- Lower and upper price.
- Spot strategy and 30-bin width.
- Estimated SOL left in the wallet after every entry transaction.

The last number must be at least 0.50 SOL. Lower the deposit until it is.

### 6. Sign and record the facts

You sign the transaction in your wallet. The monitor does not take part.

After confirmation, record:

- Public wallet address.
- Public Meteora position address.
- Entry-center bin ID.
- Actual SOL-equivalent deployed, at most 19.88.
- USD value of the deployed capital at entry.
- Swap, Meteora, and network costs in USD.
- Transaction signature for your own records.

## Phase 3: connect the live position to the monitor

In the private GitHub repository, add these under **Settings → Secrets and
variables → Actions → Variables**:

| Variable | What to enter |
| --- | --- |
| `WALLET_ADDRESS` | Your public Solana wallet address |
| `POSITION_ADDRESS` | The new public Meteora position address |
| `POSITION_CENTER_BIN_ID` | The active bin you recorded at entry |
| `INITIAL_DEPLOYED_SOL` | Actual SOL-equivalent used, no more than 19.88 |
| `INITIAL_DEPLOYED_USD` | Actual USD value at entry |
| `EXTERNAL_COSTS_USD` | Entry costs not included in Meteora PnL |

Do not round the deployed amount up to 19.88 if you used less.

### 1. Run the safe dry run

1. Open **Actions → Meteora safety monitor**.
2. Tap **Run workflow**.
3. Choose `dry-run`.
4. Open its log.
5. Confirm it prints the exact pool, position, 30-bin range, inventory, PnL,
   fees, and HODL comparison.

Dry run sends nothing and changes no state.

### 2. Reconcile before trusting it

Open the position in Meteora and compare:

- Position address.
- JUP and SOL amounts.
- Active, lower, and upper bins.
- Current position value.
- All-time fees.
- PnL.

Small rounding differences are normal. A different position, different range,
or a material PnL difference is not. Fix the data before continuing.

### 3. Initialize live monitoring

Run the workflow again with mode `run`.

This first live run creates the monthly baseline and daily snapshot. Check that
its Telegram report matches the dry run. The hourly schedule then checks at
minute 17. A healthy position sends one daily heartbeat instead of one message
per hour.

## What each phone alert means

### GREEN

Meaning: data is fresh, accounting matches, loss and range gates are clear.

Do:

1. Read the daily numbers.
2. Make no change.
3. Let the position keep earning.

### YELLOW

Meaning: the position needs attention, but one reading is not a trade command.

Do:

1. Open the official Meteora position.
2. Compare the live PnL and active bin with Telegram.
3. Prepare, but do not rebalance from one yellow alert alone.

### RED

Meaning: the range edge or loss gate is close enough to prepare action.

Do:

1. Open Meteora on your phone now.
2. Confirm the pool, position, active bin, and PnL.
3. If the red condition is real, prepare a manual risk reduction or
   rebalance. Do not add capital to rescue the position.

### CRITICAL

Meaning: the position is out of range or the critical loss gate was reached.

Do:

1. Stop adding capital.
2. Inspect the live position at once.
3. Put protection of remaining capital ahead of fee income.
4. If you decide to remove or close, review the wallet preview and sign it
   yourself.

### DATA_FAILURE

Meaning: the monitor cannot prove its numbers.

Do:

1. Do not act on the report's financial values.
2. Open Meteora and inspect manually.
3. Open the failed GitHub Actions run.
4. Restore the data or Telegram path before trusting green again.

## Monthly scorecard

On the first day of each UTC month, write down:

1. Month fee revenue.
2. Month net PnL.
3. Net return percentage.
4. Result versus holding SOL.
5. Entry and rebalance costs.

The main number is month net PnL in USD. Fees are revenue, not proof of profit.
If fees are positive but net PnL is negative, the strategy lost money.

## When you manually rebalance

1. Review and sign the close, withdrawal, swap, and new deposit yourself.
2. Record the old and new position addresses and all costs.
3. Update the six GitHub variables with the new position facts.
4. Run the monitor workflow in `rollover` mode.
5. Check the rollover confirmation box.
6. Run `dry-run`.
7. Reconcile the new report with Meteora.
8. Run `run` once to start the new baseline.

Changing the address without the explicit rollover makes the monitor emit
`DATA_FAILURE`. This prevents it from silently watching the wrong position.

## Stop signs

Stop and inspect before signing if:

- The wallet would retain less than 0.50 SOL.
- The pool address, pair, or BS80 setting differs.
- The range is not exactly 30 bins.
- The range is not centered on the live active bin.
- The quote hides slippage, fees, or token amounts.
- A website or person asks for a seed phrase.
- Telegram delivery has not passed.
- The first live report does not match Meteora.

The report is a safety gate, not a guarantee. Its job is to expose loss,
distance, bad data, and failed delivery early enough for you to make the
wallet decision yourself.
