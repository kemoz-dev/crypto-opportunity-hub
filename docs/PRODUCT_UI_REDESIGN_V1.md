# Crypto Opportunity Hub — Product UI Redesign V1

## Product principle
The home screen is for decisions; details are for evidence.

## Home screen
1. Market Regime header: regime, BTC, BTC dominance, total market, breadth/Fear & Greed when available.
2. Opportunity feed: clean cards with symbol, state, price, entry, TP1/primary target, stop, Opportunity Score, Technical Score, and detection timestamp/price.
3. Do not expose the full diagnostic payload on the home screen.

## Opportunity lifecycle
WATCH -> POTENTIAL -> QUALIFIED/CONFIRMED -> TARGET/INVALIDATED/ARCHIVED.

Every transition must preserve an immutable event containing at minimum:
- asset/symbol
- from state
- to state
- event timestamp
- market price at event
- entry zone
- stop/invalidation
- targets
- Opportunity Score
- Technical Score
- provider/data timestamp
- concise reasons

## Details
Clicking an opportunity opens its full analysis. Show Score and Technical Score prominently, then timeframe evidence, market regime, entry/stop/targets, reasons, risks, missing evidence, and event history.

## Alerts
A notification must fire on WATCH -> POTENTIAL and POTENTIAL -> QUALIFIED/CONFIRMED. Invalidations and target hits should also remain available as event alerts.

## UX constraints
- Minimal visual density.
- No duplicate metrics.
- No long explanations on the feed.
- Preserve the existing analysis engines; presentation should consume their outputs.
- Scores remain first-class product signals, not hidden or removed.
