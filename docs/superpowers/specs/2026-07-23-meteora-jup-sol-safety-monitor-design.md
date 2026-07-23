# Meteora JUP-SOL Safety Monitor

## Problem Statement

Gabe wants to allocate most of a 20.38 SOL wallet to one Meteora JUP-SOL DLMM position and maximize monthly profit in USD. The position will be managed manually from a mobile Solana wallet.

The existing plan overweights fee revenue and automation. Fee revenue alone can hide a losing position, and an operational agent would add fixed costs and wallet risk to a roughly $1,500 strategy. Gabe needs a low-cost monitor that answers four different questions without mixing them:

1. How much fee revenue did the position earn?
2. Is the position itself in profit or loss?
3. Did the strategy beat simply holding the original SOL?
4. Is the position approaching a state that needs human attention?

The monitor must reach Gabe on his phone. It must never hold a private key or perform a financial action.

## Solution

Build a deterministic, read-only monitor for one centered 30-bin Spot-Spread position in Meteora's JUP-SOL BS80 pool.

The monitor runs hourly, reads public position and pool data from Meteora, computes the financial scoreboard, assigns one safety state, formats a plain-language report, and sends it to Telegram. Email is an optional secondary delivery path.

The position plan is:

- Wallet balance before entry: 20.38 SOL.
- Operating reserve: 0.50 SOL.
- Maximum position allocation: 19.88 SOL-equivalent.
- Pool: JUP-SOL BS80 at `C8Gr6AUuq9hEdSYJzoEpNcdjpojPZwqG5MtQbeouNNwg`.
- Shape: one Spot position spread uniformly over 30 bins.
- Entry: centered on the active bin.
- Execution: every swap, deposit, claim, rebalance, withdrawal, and closure is reviewed and signed by Gabe in his mobile wallet.

The monitor reports:

- Gross all-time and month-to-date fee revenue in USD.
- All-time and month-to-date net position PnL in USD.
- Net return percentage on deployed capital.
- Current position value and token composition.
- Performance versus holding 19.88 SOL from the entry timestamp.
- Active-bin distance from the position center and each edge.
- Data freshness and accounting-consistency status.
- A single safety state and a single recommended human action.

The monitor treats safety as a precedence system. Data failure, accounting inconsistency, material loss, and range danger override positive fee revenue.

## User Stories

1. As the position owner, I want fee revenue shown separately from PnL so that fees cannot disguise a losing position.
2. As the position owner, I want month-to-date fee revenue in USD so that I know how much the position is earning this month.
3. As the position owner, I want month-to-date net PnL in USD so that I know whether the strategy is actually making money.
4. As the position owner, I want all-time net PnL in USD so that I know the result since deployment.
5. As the position owner, I want return percentage on deployed capital so that I can compare results across time periods.
6. As the position owner, I want the result compared with holding the original SOL so that I can see whether LP management added value.
7. As the position owner, I want entry and rebalance costs deducted from the strategy result so that reported profit is not overstated.
8. As the position owner, I want current JUP and SOL amounts shown so that I understand how the position inventory changed.
9. As the position owner, I want the current price and position bounds shown so that I can see where the market sits inside the range.
10. As the position owner, I want the active-bin distance from each edge so that I know how much response time remains.
11. As the position owner, I want a green state when the position is healthy so that I do not churn it unnecessarily.
12. As the position owner, I want a yellow state when the position needs watching so that I can prepare without trading too early.
13. As the position owner, I want a red state when action should be prepared so that I can open Meteora on my phone.
14. As the position owner, I want a critical state when capital protection needs immediate review so that fee chasing stops.
15. As the position owner, I want a data-failure state when the monitor cannot prove the numbers so that silence is never mistaken for safety.
16. As the position owner, I want an accounting-warning state when independent calculations disagree with Meteora's reported PnL so that suspect data is not presented as fact.
17. As the position owner, I want each alert to recommend one action so that I do not need to interpret technical output on my phone.
18. As the position owner, I want the recommendation to remain advisory so that no software can move funds without my signature.
19. As the position owner, I want a direct Meteora pool link in actionable alerts so that I can reach the position quickly from my phone.
20. As the position owner, I want Telegram delivery so that warnings reach me away from my computer.
21. As the position owner, I want delivery failures to produce a failed workflow and visible log so that a false success cannot hide a missing alert.
22. As the position owner, I want an optional email fallback so that a second phone-visible channel can be enabled later.
23. As the position owner, I want a daily summary even when the position stays green so that I can confirm the monitor is alive.
24. As the position owner, I want immediate hourly delivery for yellow, red, critical, or data-failure states so that risk is not held until the daily summary.
25. As the position owner, I want repeated green checks suppressed so that Telegram remains useful.
26. As the position owner, I want repeated danger alerts rate-limited but not silenced so that I remain informed without receiving identical messages every hour.
27. As the position owner, I want each report timestamped in UTC and São Paulo time so that I know how current it is.
28. As the position owner, I want stale upstream data marked unsafe so that old prices cannot produce a green report.
29. As the position owner, I want monthly baselines stored durably so that month-to-date figures survive stateless scheduled runners.
30. As the position owner, I want daily snapshots stored durably so that recent PnL direction can be inspected.
31. As the position owner, I want a new position address to require an explicit configuration change so that the monitor cannot silently switch targets.
32. As the position owner, I want a rebalance rollover procedure so that cumulative strategy reporting continues when the old position closes and a new one opens.
33. As the position owner, I want a dry-run mode that never sends a message so that configuration can be verified safely.
34. As the position owner, I want a forced-delivery test so that the Telegram connection can be proven before capital is deployed.
35. As the position owner, I want fixture scenarios for healthy, losing, out-of-range, stale, malformed, and unreachable data so that safety behavior is proven without using live funds.
36. As the position owner, I want secrets stored only in the deployment platform's secret store so that tokens do not enter source control.
37. As the position owner, I want the code and state repository private so that wallet and position metadata are not advertised publicly.
38. As the position owner, I want no seed phrase, private key, signing adapter, or transaction-building dependency in the project so that the monitor remains structurally read-only.
39. As the position owner, I want the monitor to use public Meteora endpoints so that it does not require a paid RPC or data subscription.
40. As the position owner, I want the monitor to use no LLM during scheduled checks so that plan quotas and model behavior cannot affect safety reporting.
41. As the position owner, I want the project to fit within the included GitHub Actions allowance at an hourly cadence so that monitoring adds no fixed monthly bill.
42. As the position owner, I want a mobile operating guide so that each safety state maps to a short manual checklist.
43. As the position owner, I want the guide to explain that losses cannot be guaranteed away so that I understand the monitor's limit.

## Implementation Decisions

### Financial definitions

- `gross fee revenue` is the position's cumulative swap-fee value in USD. It includes claimed and unclaimed fees when the upstream response makes both available without double counting.
- `net position PnL` is Meteora's position PnL in USD, less any configured external setup and rebalance costs that the position endpoint cannot observe.
- `strategy value` is the current withdrawable position value plus realized strategy withdrawals and claims, using the upstream PnL contract to avoid double counting.
- `HODL value` is the initial deployed SOL amount multiplied by the current SOL price, adjusted only by explicit later capital flows.
- `alpha versus HODL` is strategy value minus HODL value.
- `month-to-date fee revenue` and `month-to-date PnL` are differences from a durable snapshot captured at the first successful run of each UTC calendar month.
- The first live baseline is recorded only after the position exists and the owner confirms its address and initial deployed SOL equivalent.

### Accounting integrity

- Meteora's calculated `pnlUsd` is the primary position-PnL field.
- Where the response exposes deposits, withdrawals, balances, and fees, the monitor performs an independent consistency calculation.
- The monitor uses a small rounding tolerance. A larger mismatch produces a data-quality safety state and suppresses financial-action advice.
- Missing, malformed, non-finite, negative-where-impossible, or stale values are unsafe.
- Fee revenue is never added to a PnL field that already includes fees.
- Values carry source timestamps and are not silently reused after a failed fetch.

### Safety states

Exactly one state is emitted, using the first matching state in this order:

1. `DATA_FAILURE`: required data is unreachable, malformed, stale, or internally inconsistent.
2. `CRITICAL`: the position is out of range, net loss reaches the critical threshold, or multiple red conditions coincide.
3. `RED`: the active bin is ten or more bins from the entry center, five or fewer bins remain to an edge, or net loss reaches the red threshold.
4. `YELLOW`: the active bin is seven or eight bins from the center, net PnL becomes negative beyond the noise tolerance, or alpha versus HODL materially deteriorates.
5. `GREEN`: none of the higher-priority conditions apply.

Initial loss thresholds are configuration values with conservative defaults:

- Noise tolerance: -0.5% of deployed capital.
- Red loss: -2% of deployed capital.
- Critical loss: -5% of deployed capital.

The thresholds govern alert urgency, not automatic trades. The report states what triggered the state.

### Recommendations

- `GREEN`: no change; continue monitoring.
- `YELLOW`: inspect the report and prepare; do not rebalance solely because of one yellow observation.
- `RED`: open the position on mobile, verify live values, and prepare a manual rebalance or risk reduction.
- `CRITICAL`: stop adding capital, inspect immediately, and prioritize protecting remaining capital over earning more fees.
- `DATA_FAILURE`: do not trust the automated status; inspect Meteora manually and restore monitoring.

No recommendation may be emitted when the accounting-integrity check fails, except to inspect manually.

### Reporting cadence

- The check runs hourly, away from the top of the hour.
- A full heartbeat report is sent once per day.
- Yellow, red, critical, and data-failure reports are sent on detection.
- Identical danger reports are rate-limited, but a continuing danger state receives periodic reminders.
- A return to green after a danger state sends a recovery report.

### Delivery

- Telegram Bot API is the primary delivery interface.
- Email is an optional secondary interface and cannot replace a failed primary delivery until it has passed its own delivery test.
- Secrets live only in repository secrets.
- A delivery request must fail closed: an unsuccessful Telegram response makes the scheduled job fail visibly.
- Reports contain no secrets and no transaction-signing links.

### Runtime and hosting

- The monitor uses the current Node.js long-term-support runtime and standard-library features where practical.
- Scheduled execution uses a private GitHub repository and GitHub Actions.
- The monitor does not call Claude, Codex, Hermes, or another LLM during routine checks.
- The hourly job is designed to stay within the included private-repository runner allowance.
- Durable state is small JSON data committed by the workflow only for a daily snapshot, a monthly baseline, a configuration rollover, or a state transition. It is not committed on every green hourly check.

### Public interface and test seam

The system has one acceptance seam: a monitor run takes configuration, Meteora responses, prior durable state, and a clock; it returns the canonical report, next durable state, and delivery decision.

Live API fetching, fixture loading, Telegram delivery, and persistent storage sit outside that seam as adapters. This keeps all financial and safety behavior testable without network access or real funds.

The command-line interface supports:

- A fixture mode that prints the canonical report without network or delivery.
- A live dry-run mode that fetches public data and prints the report without sending.
- A delivery-test mode that sends a clearly labelled test report.
- A scheduled live mode that fetches, evaluates, persists when required, and delivers.

## Testing Decisions

Good tests assert externally visible financial and safety behavior. They do not assert private helper calls, internal module layout, or incidental formatting.

The primary acceptance tests feed complete scenarios through the monitor seam and assert:

- The financial fields presented to the user.
- The selected safety state and its triggering reasons.
- The recommended action.
- Whether delivery and durable-state changes are requested.
- The exact Telegram message snapshot for high-risk scenarios.

Required scenario coverage:

- Healthy position with positive PnL.
- Positive fees but negative net PnL.
- Negative PnL within noise tolerance.
- Red and critical loss thresholds.
- Yellow and red bin-distance thresholds.
- Out-of-range position.
- Position that underperforms holding SOL despite positive USD PnL.
- Month boundary and missing monthly baseline.
- Rebalance rollover to a new position.
- Claimed and unclaimed fees without double counting.
- Accounting mismatch.
- Stale upstream data.
- Malformed numeric strings.
- Upstream HTTP error and timeout.
- No configured position.
- Telegram success, rejection, timeout, and malformed response.
- Suppression of repeated green reports.
- Rate limiting and recovery after a danger state.

Adapter contract tests use a local HTTP server or injected fetch implementation. No test sends a real Telegram message except the explicit, manually invoked delivery test.

The full test suite, syntax/type checks, fixture dry runs, and a live no-delivery dry run must pass before deployment.

## Out of Scope

- Any private key, seed phrase, signer, transaction builder, wallet adapter, or trading instruction.
- Automatic swaps, liquidity changes, rebalances, claims, withdrawals, or closures.
- Guaranteed prevention of financial loss.
- Price prediction, directional trading signals, or promises of future return.
- Managing more than one active Meteora position in the first release.
- A web dashboard or mobile application.
- WhatsApp delivery in the first release.
- Paid RPC, database, server, model API, Droplet, or Hermes deployment.
- Tax accounting.
- Treating GitHub Actions as a real-time execution system.

## Further Notes

- The monitor is a safety and measurement tool, not a financial guarantee.
- The official Meteora Data API exposes position PnL, fee, active-bin, price, and range fields needed by the monitor.
- The wallet public address and position address are configuration, not secrets. They remain private repository metadata because they disclose financial activity.
- Telegram credentials, optional email credentials, and any future provider credentials are secrets.
- Entry must not occur until the unsigned Meteora quote has been inspected, the 0.50 SOL reserve remains available, and the delivery test has reached Gabe's phone.
- After deployment, the first live report must be manually reconciled with the Meteora UI before the monitor is trusted.
