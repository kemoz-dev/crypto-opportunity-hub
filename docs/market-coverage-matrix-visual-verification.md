# Market Coverage Matrix Visual Verification

On 2026-08-22 UTC, the development workspace opened the **Historical Data Foundation** dialog from the dashboard navigation. The dialog displayed the immutable-lineage and Market Coverage Matrix heading with its explicit non-mutation disclosure.

The subsequent rendered state correctly enforced the protected-data boundary and showed the **Sign in to inspect historical research data** state. This browser session does not currently hold an authenticated project session, so the populated protected matrix cannot yet be visually inspected. The check did not invoke scoring, alerts, paper trading, or any trade operation. After sign-in, confirm the current-survivor and historical-sector-unavailable warnings and a populated matrix row set.

After checkpoint `eed35c09` was saved, the production domain served the dashboard and its **Historical Data** entry point. At the immediate check, the rendered dialog still displayed the prior Historical Data layout rather than the new Market Coverage Matrix content. This is recorded as a **deployment-propagation verification pending** state; no claim is made that the new protected matrix was visually verified on the published build. The populated protected matrix also remains intentionally inaccessible without an authenticated project session.

The same prior-layout response was observed immediately after the follow-up publish checkpoint `ceb83227`, despite the deployment-success notification. The release therefore remains technically checkpointed and deployed, but production UI propagation and authenticated matrix inspection are both still pending independent verification.

The authenticated production session subsequently loaded dataset `300001` and the existing per-scope audit rows, confirming the historical-data access boundary and persisted data are available on the production domain. Browser inspection showed the active production JavaScript asset as `assets/index-Di9y6LQr.js` and no rendered `Market Coverage Matrix` string. The production page therefore still reflects the earlier client bundle at this observation point; the new matrix UI has not been claimed as production-verified.

A cache-busted production load later served a different client asset (`assets/index-CTxLs_r8.js`) but still did not render `Market Coverage Matrix`. The remaining production-UI issue is therefore not treated as a browser-cache-only result.

The current development build was separately opened after the production checks. Its Historical Data dialog rendered the new heading, **Immutable data lineage, Market Coverage Matrix, closed-candle reconstruction, and research-cost assumptions**, confirming that the new client implementation is active in development. The dialog began its protected data load; final populated-matrix inspection remains dependent on the active authenticated browser session.

After the protected queries settled, the development dialog correctly displayed **Sign in to inspect historical research data**. This confirms the intended unauthenticated guard; it does not substitute for the remaining signed-in populated-matrix inspection.

The later development check again showed live scanner data but the Historical Data dialog’s **Sign in** guard. This confirms that dashboard market data is public while historical coverage evidence remains protected; a dedicated authenticated project session is still required for the remaining populated matrix inspection.

OAuth diagnosis: the blank login handoff eventually returned to the callback with `{"error":"invalid oauth state"}`. The callback’s secure one-time nonce check rejected a delayed login attempt, which is the intended CSRF protection. A fresh application-initiated sign-in attempt is required and must complete within the nonce’s ten-minute lifetime.

After a fresh sign-in succeeded, an authenticated request to `crypto.marketCoverageMatrix` returned HTTP 200 with dataset `300001`, immutable snapshot `60001`, and 20 registry rows. This verifies that protected coverage data is correctly accessible and persisted. The initially rendered `0 registry assets` state is therefore being treated as a client query-settlement/rendering issue, not an access-control or data-persistence failure.

The subsequent authenticated development rendering completed successfully. It showed 20 registry assets, the `CURRENT SURVIVOR UNIVERSE` warning, the `HISTORICAL SECTOR DATA UNAVAILABLE` warning, per-timeframe 15M/1H/4H/1D evidence, market-cap and regime statuses, aggregate coverage, longest gap, quality, latest-observed time, and PEPE as an explicit missing scope. This completes the signed-in development visual verification.

Published-client verification then progressed: the production domain now renders the new Market Coverage Matrix UI. Its protected historical-data queries currently return no selected dataset or coverage rows, and the explicit `Coverage Matrix unavailable` state renders instead. This separates client propagation (now verified) from a remaining production historical-data availability/authentication diagnosis.

After the authenticated production requests settled, the published dialog completed successfully. It rendered the selected sealed dataset `300001`, all 20 Market Coverage Matrix rows, snapshot context, current-survivor and historical-sector-unavailable warnings, timeframe coverage, quality cells, and the explicit missing PEPE row. This completes published-client and signed-in matrix verification.
