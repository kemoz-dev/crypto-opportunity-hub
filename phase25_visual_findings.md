# Phase 25 Visual and Runtime Findings

- Preview desktop (1280px): `/asset/bitcoin` opens the full Asset Trade Investigation Workspace with Bitcoin identity, live score 67.2/100, confidence 87.9/100, current price, OHLCV provider/timestamp, Summary-first hierarchy, and responsive dialog bounds. No horizontal page overflow observed.
- Preview mobile (390px): the same canonical workspace is edge-to-edge, the header and Summary cards fit the viewport, and fixed mobile navigation remains visible as expected. Evidence sections use compact disclosure controls with 44px-class touch targets.
- Preview unavailable-state behavior: if provider data is unavailable, the identity-only route fallback keeps market fields null and shows honest unavailable states rather than fabricated candles, price, score, or provider values.
- Published production smoke before the new checkpoint: `https://cryptohub-dfa6xdxp.manus.space/asset/bitcoin` returned the existing 404/stale deployment shell with a billing/limited-site banner. This is expected to require the Phase 25 checkpoint publication before accepting production runtime verification; no production mutation or authentication bypass was attempted.
