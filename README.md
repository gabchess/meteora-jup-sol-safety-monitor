# Meteora JUP-SOL Safety Monitor

A read-only phone alert system for one JUP-SOL DLMM position.

The monitor measures the result that matters: net USD PnL. It keeps fee
revenue, net PnL, return on capital, and performance versus holding SOL
separate, so a large fee number cannot hide a losing position.

## Locked strategy

- Starting wallet: 20.38 SOL.
- Hard operating reserve: at least 0.50 SOL after all entry costs.
- Maximum strategy spend: 19.88 SOL-equivalent, including entry costs.
- Pool: JUP-SOL BS80,
  `C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`.
- Position: one Spot distribution, exactly 30 bins, centered on the active
  bin at entry.
- Execution: the owner reviews and signs every wallet action.

The monitor has no wallet library, signer, transaction builder, private key,
or seed phrase. It cannot trade.

## What the phone report contains

- Month-to-date and all-time fee revenue.
- Month-to-date and all-time net PnL.
- Net return on deployed capital.
- Gain or loss versus holding the original SOL.
- Current JUP and SOL inventory.
- Active price, range, bin distances, and safety reason.
- One status: `GREEN`, `YELLOW`, `RED`, `CRITICAL`, or `DATA_FAILURE`.
- One plain-language human action.

Green checks stay quiet except for one daily heartbeat. A danger-state change
sends at once, an unchanged danger state sends a six-hour reminder, and a
return to green sends a recovery report.

## Run locally

Node.js 22 or later is the only runtime requirement. The project has no npm
dependencies.

```bash
npm run build
npm run report -- fixture test/fixtures/healthy.json
npm run report -- dry-run
npm run report -- telegram-chat-id
npm run report -- delivery-test
npm run report -- run
```

`dry-run` reads public Meteora data and prints the canonical report. It never
sends Telegram and never saves state. `delivery-test` sends a labelled test
with no financial recommendation. `run` fetches, evaluates, sends when due,
and saves the approved state.

## Private GitHub Actions setup

Keep this repository private. Under **Settings → Secrets and variables →
Actions**, add:

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

The workflow runs at minute 17 of each hour. It tests the project before each
check, prevents overlapping runs, commits only `state/monitor.json`, and fails
visibly if Meteora data or Telegram delivery fails. At roughly 720 hourly jobs
per 30-day month, it stays below the current 2,000-minute GitHub Free private
repository allowance if each job bills as one minute.

## Position rollover

Changing `POSITION_ADDRESS` alone makes the monitor fail safe. After the owner
has manually closed or moved the position:

1. Update the repository variables for the new position and entry values.
2. Open **Actions → Meteora safety monitor → Run workflow**.
3. Choose `rollover`.
4. Check the rollover confirmation box.
5. Run `dry-run` and reconcile the new report before restoring scheduled trust.

The rollover command changes monitor state only. It cannot touch the wallet.

## Operating guide

Read [the ELI5 setup and phone playbook](docs/ELI5-OPERATING-GUIDE.md) before
depositing any capital.

## Source contracts

- [Meteora position PnL API](https://docs.meteora.ag/api-reference/dlmm/positions/get-position-pnl-data-open-and-closed-positions-with-on-the-fly-calculation)
- [Meteora pool API](https://docs.meteora.ag/api-reference/dlmm/pools/pool)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

Monitoring shortens response time. It cannot prevent smart-contract loss,
price loss, bad fills, API outages, wallet compromise, or every other way
capital can be lost.
