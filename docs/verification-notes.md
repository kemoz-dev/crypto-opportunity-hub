# Verification Notes

## Initial Preview Check

At 2026-08-21 14:14 GMT+3, the preview initially rendered a blank white viewport after the live-scanner interface was added. The browser console contained no reported client error. A completed subsequent check confirmed that live CoinGecko and Binance inputs populated the scanner and detail card correctly. A responsive layout correction then separated the wide research card from the primary scanner pane below the 2XL breakpoint.

At 2026-08-21 14:17 GMT+3, the browser began a fresh live scan and remained in its explicit loading state during the first six seconds. This is expected while the server completes the batched public-source requests. The application does not display stale or fabricated scanner rows while that query is unresolved.

## Integrated Platform Verification

At 2026-08-21 14:47 GMT+3, the completed scanner showed live CoinGecko and Binance-backed ranked results and active navigation for Settings, Paper Trading, Backtesting, and Alerts. Opening Settings as an unauthenticated visitor displayed an explicit sign-in gate rather than exposing a writable configuration form. This confirms the public scanner continues to use documented defaults while personalized controls remain protected.

## Validation-Release Verification

At 2026-08-21 15:34 GMT+3, the existing published domain was reachable and showed the explicit no-score state while its live scan had not completed; it did not display a fabricated price or opportunity. At 15:38 GMT+3, the local updated build exposed the new **Research Summary** navigation entry. The subsequent checkpoint is required to carry this new validation view to the published release.

At 2026-08-21 15:39 GMT+3, an unauthenticated local `POST` request to the scheduled-alert callback returned only `{"error":"cron-only"}` with HTTP 403. The handler did not invoke alert evaluation, return a stack trace, or expose configuration or secret material. A successful scheduled execution remains unverified because no authenticated user-owned alert schedule exists yet.

At 2026-08-21 15:44 GMT+3, the published release at `https://cryptohub-dfa6xdxp.manus.space` propagated the new **Research Summary** navigation. An unauthenticated production `POST` to `/api/scheduled/evaluate-alert` returned HTTP 403 with a cron-cookie permission error, confirming that public requests cannot invoke scheduled alert evaluation. A successful scheduled execution cannot be observed until an authenticated user creates an alert rule on the published release.
