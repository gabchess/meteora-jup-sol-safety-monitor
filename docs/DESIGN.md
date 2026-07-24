# Meteora JUP-SOL Safety Monitor Design

## Problem

A concentrated-liquidity position can earn fees while losing money. The
operator needs a phone-visible report that separates revenue from profit,
compares the result with holding SOL, and warns when the range or data becomes
unsafe.

The reporting system must not increase custody risk. It may read public data
and send an advisory message, but it may never hold a key, construct a
transaction, or trade.

## Scope

The first release monitors one manually managed position:

- Meteora JUP-SOL BS80 pool.
- One Spot distribution across exactly 30 bins.
- A recorded entry-center bin.
- Telegram as the delivery channel.
- GitHub Actions as the scheduled runner.
- JSON state committed to the repository for accounting and alert memory.

Managing the wallet, predicting prices, automating trades, and preventing all
losses are outside the scope.

## Financial model

The report keeps four results separate:

1. Gross fee revenue in USD.
2. Net position PnL after configured external costs.
3. Net return on deployed capital.
4. Gain or loss versus holding the original SOL.

Meteora's `pnlUsd` is the primary position-PnL field. The monitor also checks
the available deposits, withdrawals, balances, and fees. A material mismatch
produces `DATA_FAILURE`; it does not present suspect numbers as fact.

Month-to-date values are differences from a durable baseline captured by the
first trusted run of each UTC month. Rollover state carries lifetime PnL and
fee totals from a closed position to its replacement.

## Safety states

Exactly one state is emitted, using the first matching state:

1. `DATA_FAILURE`: required data is missing, malformed, stale, or internally
   inconsistent.
2. `CRITICAL`: the position is out of range, loss reaches the critical
   threshold, or multiple red conditions occur together.
3. `RED`: a range-edge, center-distance, or loss threshold requires prompt
   inspection.
4. `YELLOW`: the position needs attention but one observation does not justify
   a trade.
5. `GREEN`: no higher-priority condition applies.

Each state maps to one advisory action. Only the operator may decide and sign
a wallet action.

## Data integrity

A trusted report requires:

- The configured open position and approved pool.
- The JUP-SOL token pair and BS80 bin step.
- Exactly 30 integer bin IDs with the recorded entry bin centered.
- Valid price bounds and agreement between the pool and position endpoints.
- Finite financial values and no negative value where one is impossible.
- A successful independent PnL consistency check.
- A response fetched within the configured age limit.

Meteora does not expose the internal index-update timestamp in these
responses. The monitor records retrieval time and cross-checks the current
price, but it does not claim to prove the index age.

## Delivery

The check runs hourly. Delivery is quieter:

- A new danger state sends immediately.
- An unchanged danger state sends a reminder after six hours.
- Green sends one daily heartbeat.
- Recovery from danger to green sends immediately.
- Telegram rejection, timeout, or malformed output fails the workflow.

The same canonical message is printed in a dry run and sent in a live run.
This makes the phone output testable without contacting Telegram.

## Security boundary

The runtime uses public Meteora data and standard Node.js APIs. It has no npm
dependencies.

The repository contains:

- Public pool, wallet, and position identifiers.
- Public financial state and reports.
- Source, fixtures, and tests.

GitHub repository secrets contain:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

The monitor rejects common wallet-secret environment variables. It contains
no signer, wallet adapter, RPC transaction code, or signing link.

The scheduled workflow runs only from the repository's default branch or an
explicit maintainer dispatch. Pull requests run the read-only CI workflow and
receive no monitor secrets.

## Test seam

`evaluateMonitorRun` takes configuration, a Meteora snapshot, prior state, and
a clock. It returns:

- The financial and safety report.
- The canonical Telegram message.
- The delivery decision.
- The next durable state.

Network fetching, Telegram delivery, fixture loading, and file storage are
adapters outside this seam. Tests cover healthy, losing, out-of-range, stale,
malformed, accounting-mismatch, rollover, delivery-failure, reminder, and
recovery scenarios without using live funds.
