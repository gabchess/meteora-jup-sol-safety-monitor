# Meteora JUP-SOL Safety Monitor

A deterministic, read-only monitor for one manually managed Meteora DLMM
position. It sends phone alerts without holding a wallet key or signing a
transaction.

The monitor reports net USD PnL as the main result. It keeps fee revenue, net
PnL, return on capital, and performance versus holding SOL separate, so fees
cannot hide a losing position.

## What it monitors

- Pool: JUP-SOL BS80,
  `C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`.
- Position shape: one Spot distribution across exactly 30 bins.
- Month-to-date and all-time fee revenue.
- Month-to-date and all-time net PnL.
- Return on deployed capital.
- Gain or loss versus holding the original SOL.
- Current JUP and SOL inventory.
- Active price, range, bin distances, and data integrity.
- One status: `GREEN`, `YELLOW`, `RED`, `CRITICAL`, or `DATA_FAILURE`.

Green checks stay quiet except for one daily heartbeat. A status change sends
at once. An unchanged danger state sends a reminder after six hours. A return
to green sends a recovery report.

## Security model

The monitor contains no wallet library, signer, transaction builder, private
key, or seed phrase. It cannot trade.

Every swap, deposit, claim, rebalance, withdrawal, and closure remains a
manual wallet action. GitHub Actions receives only public on-chain identifiers
and two Telegram credentials stored as repository secrets.

This repository runs a live monitor. Its committed state, public wallet and
position identifiers, and financial output in Actions logs are intentionally
public. No secret belongs in state, logs, issues, fixtures, or source control.

## How it works

1. GitHub Actions checks the position once per hour.
2. The Meteora adapter reads the public pool and position PnL endpoints.
3. The monitor validates the pool, range, prices, accounting, and data shape.
4. It calculates PnL, fees, return, HODL comparison, and safety status.
5. Telegram receives reports only when the delivery rules require one.
6. The workflow commits the small JSON state used for accounting and alert
   memory.

The financial and safety logic is a pure test seam. Network access, Telegram,
and state storage sit outside it as adapters. See
[the design document](docs/DESIGN.md) for the contracts and failure rules.

## Run locally

Node.js 22 or later is the only runtime requirement. The project has no npm
dependencies.

```bash
npm run build
npm run report -- fixture test/fixtures/healthy.json
npm run report -- dry-run
npm run report -- telegram-chat-id
npm run report -- delivery-test
npm run report -- initialize
npm run report -- run
```

`dry-run` reads public Meteora data and prints the canonical report. It never
sends Telegram and never saves state. `delivery-test` sends a labelled test
with no financial recommendation. `initialize` records the first reconciled
live baseline. `run` requires trusted state, then fetches, evaluates, sends
when due, and saves the next state.

## GitHub Actions setup

Under **Settings → Secrets and variables → Actions**, add:

Secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Repository variables:

- `WALLET_ADDRESS`
- `POSITION_ADDRESS`
- `POSITION_CENTER_BIN_ID`
- `INITIAL_DEPLOYED_SOL`
- `INITIAL_DEPLOYED_USD`
- `EXTERNAL_COSTS_USD`
- `MONITOR_ENABLED` (`false` until initialization, then `true`)

The scheduled workflow runs at minute 17 of each hour when
`MONITOR_ENABLED=true`. It tests the project before each check, prevents
overlapping runs, commits only `state/monitor.json`, and fails visibly when
Meteora data or Telegram delivery fails.

## Position rollover

Changing `POSITION_ADDRESS` alone makes the monitor fail safe. After the
operator manually closes or moves the position:

1. Set `MONITOR_ENABLED=false` and run one final report for the old position.
2. Update `POSITION_ADDRESS`, `POSITION_CENTER_BIN_ID`, and
   `EXTERNAL_COSTS_USD`. Keep the original deployment baselines.
3. Run the workflow in `rollover` mode and confirm the rollover.
4. Run `dry-run`, reconcile the new report, then run `run`.
5. Set `MONITOR_ENABLED=true`.

The rollover command changes monitor state only. It cannot touch the wallet.

## Source contracts

- [Meteora position PnL API](https://docs.meteora.ag/api-reference/dlmm/positions/get-position-pnl-data-open-and-closed-positions-with-on-the-fly-calculation)
- [Meteora pool API](https://docs.meteora.ag/api-reference/dlmm/pools/pool)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

Monitoring reduces response time. It cannot prevent smart-contract loss,
price loss, bad fills, API outages, wallet compromise, or every other way
capital can be lost.

Meteora's current pool and position responses do not publish an index-update
timestamp. The monitor records retrieval time and cross-checks current price
between both endpoints, but it cannot prove the age of Meteora's internal
index.
