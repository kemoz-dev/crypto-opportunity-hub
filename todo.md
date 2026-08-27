# Project TODO

- [x] Validate the React, Express, tRPC, Drizzle, and MySQL foundation and document the Phase 1 architecture.
- [x] Create configurable database entities for assets, normalized market snapshots, technical snapshots, score snapshots, sector classifications, data-source status, user preferences, immutable paper trades, portfolios, backtest runs, backtest results, and alerts.
- [x] Implement a provider-neutral market-data layer with CoinGecko and Binance adapters, normalization, timestamps, source status, and graceful unavailable-data handling.
- [x] Implement technical calculations for RSI, MACD, EMA 20/50/200, Bollinger Bands, ATR, volume expansion, and price-structure signals across 15m, 1H, 4H, and 1D.
- [x] Implement explainable multi-timeframe, market-regime, liquidity/risk, sector-relative-strength, opportunity, and confidence scoring with configurable weights.
- [x] Build the Phase 1 dashboard and scanner with real-data states, filters, explainable ranked results, per-timeframe contributions, and an opportunity-detail view.
- [x] Build centralized settings for score weights, indicator inputs, active timeframes, risk limits, paper capital, and sector-model configuration.
- [x] Build the paper-trading lab and portfolio metrics with immutable entry snapshots.
- [x] Build the anti-look-ahead historical backtesting engine and score-research analytics.
- [x] Build explainable threshold alerts with monitored-score conditions and timestamped signal context.
- [x] Add Vitest coverage for data normalization, technical calculations, score explanations, immutable trades, and anti-look-ahead backtesting constraints.
- [x] Verify data integrity, type safety, and responsive dashboard rendering with no fabricated market values.
- [x] Document the implementation, remaining staged features, data-source limitations, and deployment handoff.
- [x] Complete missing technical detections: RSI recovery/divergence, MACD divergence/context, EMA crossover, Bollinger squeeze/rejection, and the specified price-action structures.
- [x] Add a deployment and operations handoff covering development commands, live-data behavior, persistence checks, verification steps, and Phase 2+ boundaries.
- [x] Make chronological backtests apply the user-selected timeframe end-to-end and persist score-combination research analytics.
- [x] Add configurable historical entry, stop-loss, take-profit, and risk-sizing rules to the backtest engine and prove their impact with Vitest coverage.
- [x] Verify the published release’s scheduled-alert activation path, cron-only authentication boundary, published scoring configuration usage, failure logs, and secret exposure boundary without attempting real trades.
- [x] Strengthen immutable paper-trade observation snapshots to preserve all requested live signal, regime, sector, price, risk, and score-component evidence at creation time.
- [x] Extend real-data historical research to compare requested score combinations, opportunity and confidence thresholds, multi-regime behavior, and available 24H/3D/7D/30D outcome windows without fabricating insufficient samples.
- [x] Compare generic and supported sector hypotheses against available historical evidence and label results as Supported, Weak Evidence, Unsupported, or Insufficient Data.
- [x] Perform a focused anti-look-ahead audit covering indicators, volume, market context, sector inputs, score components, risk calculations, alert snapshots, entries, and exits; document any leakage risk.
- [x] Build a transparent Research Summary page showing validated evidence, observation counts, limitations, weakest and strongest combinations, threshold results, sector evidence, and non-guarantee disclosure.
- [x] Add Vitest coverage for immutable observation evidence, research aggregation, threshold/sector labeling, and anti-look-ahead boundaries.
- [x] Produce a real-data validation report with tested scope, signal counts, evidence status, weaknesses, and scoring-model recommendations; explicitly label insufficient data.
- [x] After deployment, create one authenticated user-owned alert and verify its first scheduled execution and logs; do not create the alert on the user’s behalf.
- [x] Add focused threshold-status and sector-evidence-label tests for `buildValidationResearch()`.
- [x] Publish one consolidated validation report that includes evidence, anti-look-ahead result, limitations, and scoring-model recommendations end-to-end.
- [x] Extend alert conditions to enforce non–Risk Off regime, 4H contribution, and bullish setup constraints without changing the scoring formula.
- [x] Add supported notification delivery for triggered test alerts while preserving no-trade behavior and immutable signal evidence.
- [x] Create the user-authorized hourly production test alert with 80/70/30 thresholds, any asset, any sector, and paper/real trading disabled.
- [x] Verify the persisted schedule, first successful scheduled execution, exact scoring configuration, execution timestamp, recorded matches, no-trade boundary, unchanged user settings, and rejected unauthenticated access.
- [x] Reconcile the active alert’s user ownership with the user’s explicit in-chat authorization to select the account and submit the exact test rule.
- [x] Document the production failure-log verification boundary: no failure was intentionally induced, while the scheduled handler’s sanitized-failure behavior is code-audited and unauthenticated production access is proven rejected.
- [x] Re-read and verify the saved authorization-reconciliation and failure-log-boundary documentation before checkpointing.
- [x] Define an immutable point-in-time alert-execution snapshot contract covering status, duration, scanned count, matches, notification state, scoring configuration, regime, sector, and signal evidence.
- [x] Persist complete immutable execution snapshots for scheduled and manual evaluations without altering the active hourly alert or scoring formula.
- [x] Persist exact point-in-time market-regime inputs, sector context, data provenance/freshness, and unavailable values for each alert execution.
- [x] Persist immutable per-signal indicator, score-component, multi-timeframe, price, regime, sector, and scoring-version evidence for every qualifying match.
- [x] Build authenticated alert execution-history retrieval with list and detail views that never reconstruct historical records using current data.
- [x] Build an Alerts execution-history table and detailed snapshot inspector that clearly separates point-in-time evidence from current market state.
- [x] Add Vitest coverage for execution persistence, snapshot immutability, regime/sector provenance, configuration preservation, status handling, historical retrieval, authentication, and no-trade boundaries.
- [x] Verify the existing hourly Test Alert — High Opportunity 4H remains unchanged after the observability upgrade and document all schema/UI additions and limitations.
- [x] Add integration coverage for immutable execution-row persistence and authenticated historical list/detail retrieval using the new snapshot fields.
- [x] Re-verify and record the active hourly alert’s thresholds, 4H condition, schedule identity, notification setting, and no-trade boundary after the observability upgrade.
- [x] Re-read and verify the saved snapshot-contract documentation lists schema changes, UI components, stored fields, legacy limitations, and the unchanged-alert boundary.
- [x] Add authenticated tRPC router coverage for execution-history list and detail retrieval, including cross-user access denial.
- [x] Record the post-upgrade active-alert verification, including unchanged 80/70/30 thresholds, 4H condition, schedule identity, notifications, and no-trade boundary.
- [x] Expand and re-verify the snapshot-contract document with explicit schema changes, new UI components, full stored-field categories, legacy limitation, and unchanged-hourly-alert boundary.
- [x] Add an authenticated wrong-user execution-history test that proves list and detail history access is denied when the alert does not belong to that user.
- [x] Audit the current backtesting, scoring, stored historical data, and UI boundaries for a reproducible Opportunity Research Lab without modifying production scoring or alert behavior.
- [x] Define persisted, user-owned experiment configurations for controlled technical combinations, score/confidence thresholds, timeframes, date range, sector/regime filters, time-based splits, and non-look-ahead entry/exit rules.
- [x] Implement reproducible historical experiment runs with forward-return, risk, calibration, regime, sector, in-sample, and out-of-sample metrics, including explicit insufficient-data handling.
- [x] Persist experiment metadata, source/provenance, exact configuration, results, and exportable CSV/JSON snapshots without modifying production scoring weights or trading behavior.
- [x] Build an authenticated Opportunity Research Lab with experiment controls, transparent variable membership, research labels, results segmentation, calibration views, best-candidate reasoning, and exports.
- [x] Add tests for experiment persistence, filtering, forward returns, time splits, segmentation, calibration, anti-look-ahead protection, insufficient data, authentication/authorization, alert continuity, and no-trade boundaries.
- [x] Run reproducible real-data research only where retained data is sufficient; document coverage, measured findings, limitations, and whether a robust edge or V2 case exists.
- [x] Add Research Lab controls for date range, asset scope, sector, and regime; wire them into persisted runs and exports.
- [x] Add targeted coverage proving Research Lab runs do not create paper trades or alter alerts, schedules, scoring settings, or real-trading boundaries.
- [x] Include complete immutable experiment configuration and filter controls in CSV exports, and test persistence plus JSON/CSV export coverage.
- [x] Audit existing provider, research, persistence, database, and scheduler boundaries for point-in-time historical data infrastructure without changing production scoring, alerts, or trading.
- [x] Define an immutable versioned dataset protocol covering OHLCV, quality states, historical market cap, regime, sector context, cost assumptions, instrument separation, availability markers, and survivorship limitations.
- [x] Add persistent, UTC-based OHLCV, dataset-version, ingestion-run, data-quality, missing-interval, historical market-cap, market-regime, and sector-context schemas with exact uniqueness constraints and non-destructive migrations.
- [x] Implement free/public-source OHLCV backfill and incremental ingestion across 15M/1H/4H/1D with resume state, malformed/duplicate/missing detection, provider-error recording, and data-quality updates.
- [x] Persist available historical market-cap, regime, and sector context without reconstructing unavailable history from present-day values.
- [x] Build closed-candle, multi-timeframe-safe point-in-time reconstruction and research-only spot/perpetual cost calculations that keep gross and net results separate.
- [x] Extend Research Lab and add a protected historical data-quality dashboard with dataset version, date, asset, instrument, cost, coverage, and availability controls.
- [x] Add deterministic scheduled ingestion through the existing platform scheduler, with idempotency, authenticated callback handling, and documented timeout/coverage constraints.
- [x] Add tests for ingestion integrity, duplicate and missing detection, dataset versioning, historical context persistence, reconstruction timing, cost handling, immutable run provenance, auth, and unchanged production/no-trade boundaries.
- [x] Backfill reliable public history where available, document actual coverage and unavailable fields, validate the production build, and publish the completed data-foundation checkpoint.
- [x] Correct scheduled-ingestion authentication error handling and research-cost decimal rounding identified by deterministic tests, then re-run the full validation suite.
- [x] Re-run complete post-fix type check, test suite, and production build after the scheduled-ingestion and research-cost corrections.
- [x] Preserve explicit historical-context lineage when a scheduled incremental dataset branches from a sealed predecessor, then verify the first successful scheduled version retains those snapshots without current-value substitution.
- [x] Add Vitest coverage for historical dataset version creation, sealing, and incremental branching lineage.
- [x] Add persistence coverage for inherited historical market-cap, regime, unavailable-sector, and survivorship-availability records.
- [x] Add immutable dataset-backed Research Lab provenance coverage, including dataset/model/cost identifiers and no-mutation boundaries.
- [x] Correct the dataset-version test mock to supply independent quality and ingestion-run result arrays for sealing validation.
- [x] Add Vitest coverage for incremental historical dataset branching from a sealed predecessor, including inherited quality/gap state and immutable predecessor metadata.
- [x] Audit existing historical coverage and select a representative free-source multi-sector market universe without using today’s rankings as historical membership.
- [x] Design and document the persistent Market Universe registry, immutable dataset universe snapshots, inclusion reasons, availability statuses, current-versus-historical universe label, and survivorship warning model.
- [x] Add non-destructive schema and services for registry assets, versioned universe composition, per-scope coverage metrics, longest gaps, and data-quality scores that are separate from Opportunity Score.
- [x] Investigate historical sector-classification sources for timestamp accuracy, methodology, coverage, provenance, and consistency; retain the explicit unavailable status if no source qualifies.
- [x] Backfill prioritized multi-asset 15M and 1H public OHLCV in bounded resilient batches, preserving duplicate prevention, gaps, partial failures, retry state, and immutable dataset lineage.
- [x] Extend scheduled ingestion for tiered expanded-universe batches with persisted status, processed assets, candle counts, gaps, and errors, without changing the existing hourly alert.
- [x] Build an authenticated Market Coverage Matrix with asset/timeframe/context availability, coverage percentage, longest-gap, quality score, universe inclusion reason, and historical/current-universe bias warnings.
- [x] Add Vitest coverage for universe persistence/versioning, inclusion/exclusion, multi-asset partial failures, coverage/quality calculation, sector provenance/unavailability, protected access, and unchanged production boundaries.
- [x] Document actual asset and sector representation, timestamp coverage, data-quality distribution, source limitations, survivorship disclosure, and schedule status; run full validation and publish the checkpoint without rerunning Research Lab or changing the Opportunity Engine.
- [x] Correct the three new expanded-universe scheduled task paths to the deployed cron-only ingestion callback and verify their persisted task identities remain unchanged.
- [x] Add explicit historical-coverage query error states and perform an authenticated visual verification of the Market Coverage Matrix.
- [x] Diagnose and resolve the blank OAuth sign-in handoff and confirm the published client serves the Market Coverage Matrix release before final visual verification.
- [x] Inspect the three expanded production ingestion schedules and record first execution evidence with task, run, timing, asset, candle, gap, provider, retry, and final-status fields.
- [x] Add immutable missing-range and retry-lineage persistence that preserves original provider failures, retry linkage, duplicate prevention, and dataset-version immutability.
- [x] Add protected Ingestion Health and Research Dataset Readiness views showing runs, availability, failures, gaps, coverage, and informational readiness rationale without auto-starting research.
- [x] Add deterministic coverage for scheduled execution persistence, partial batches, retry behavior, duplicate prevention, missing ranges, lineage, readiness, PEPE, authentication, authorization, and no-mutation boundaries.
- [x] Propagate real retry attempts into scheduled/incremental runs and execution metrics, with original issue linkage for retry success or failure.
- [x] Add end-to-end deterministic retry tests proving failed-scope preservation, successful retry linkage, duplicate prevention, and protected missing-range inspection.
- [x] Persist and display each failed or missing range's last-checked timestamp and retry status, preserving append-only source evidence.
- [x] Add next scheduled run visibility to the protected Ingestion Health view using durable platform-compatible schedule metadata.
- [x] Observe first production executions of all three expanded schedules, run full validation, publish the result, and report the requested ingestion-health evidence without starting Research Lab.
- [x] Run the user-authorized one-time follow-up after 2026-08-23 03:20 UTC; inspect the three first scheduled executions, report the requested evidence, and then stop without any prohibited mutations.
- [x] Add deterministic registry inclusion/exclusion, immutable snapshot persistence/versioning, multi-asset partial-failure, and no-mutation boundary tests for the market-universe flow.
- [x] Define the research-only Execution Cost & Liquidity model, explicit unavailable-data handling, point-in-time rules, and strict non-mutation boundary from Opportunity Engine, alerts, trading, and active Research Lab runs.
- [x] Add immutable, versioned persistence for cost models, liquidity tiers and observations, historical-funding availability, and user-owned cost-study results with full dataset and assumption provenance.
- [x] Implement deterministic spot/perpetual cost calculations for fees, slippage, estimated volume impact, explicit funding availability or assumptions, net-versus-gross outcomes, sensitivities, and stress scenarios.
- [x] Add protected Execution Cost Lab APIs and interface with transparent configuration, trade-size, instrument, liquidity, funding, stress, and cost-breakdown states.
- [x] Add tests, migration validation, TypeScript/build validation, documentation, and non-mutation assertions for the research-only cost engine without starting a new Research Lab experiment.
- [x] Perform and document a read-only deployment-persistence audit covering database-backed historical data, snapshots, research records, schedule dependencies, backup posture, portable export feasibility, and worst-case recovery without production mutation.
- [x] Define the versioned portable disaster-recovery archive contract, manifest, checksums, ownership scope, retention policy, and explicit portable/partial/non-portable classification without changing protected behavior.
- [x] Add durable backup metadata and authenticated full-system archive generation covering historical lineage, market-universe, context, research, execution-cost, and ingestion-operational evidence while preserving relationships.
- [x] Implement isolated archive restore validation with source-versus-restored counts, checksum comparison, relationship checks, dataset-version and immutable-snapshot preservation, and explicit mismatch reporting.
- [x] Build protected backup inspection/download controls and recovery documentation, keeping backup status separate from ingestion status and leaving existing ingestion schedules unchanged.
- [x] Create and verify the first stored disaster-recovery archive, run full tests, TypeScript and production-build validation, and report portability limits without starting Research Lab or modifying scoring, alerts, or trading.
- [x] Expose the already verified primary disaster-recovery ZIP through a dedicated authenticated owner-only download action with its exact metadata and validation evidence.
- [x] Verify the protected download returns the exact primary ZIP and document its size, export ID, verification, and checksum result without regenerating the archive.
- [x] Perform a read-only Preview-versus-published-production comparison of runtime, database, configuration, providers, live inputs, callback availability, and billing/deployment status; report only the production live-score diagnosis.
- [x] Audit existing public OHLCV integrations and verify whether a compatible fallback can provide normalized candles, volume, timestamps, required timeframes, and historical/current availability without adding an unverified provider.
- [x] Implement provider-neutral live OHLCV acquisition with explicit Binance HTTP 451 regional-restriction classification, coherent single-provider series validation, immutable provenance, and unavailable-only fallback failure behavior.
- [x] Add provider-health visibility and dashboard provenance/data-quality states while preserving the existing Opportunity Engine formula, settings, alerts, trading, research, providers, and ingestion schedules.
- [x] Add deterministic tests for 451, fallback success/failure, invalid candles, mapping/timeframe/timestamp/volume validation, provenance, mixed-provider prevention, unavailable handling, and unchanged existing scoring behavior; run full validation and report the verified outcome.
- [x] Define the deterministic read-only provider-health monitor contract, bounded cadence, immutable evidence fields, controlled fallback-path coverage, and cron-only authorization boundary without producing scores, signals, trades, or user trading alerts.
- [x] Add durable provider-monitor configuration and execution-history persistence for provider/capability/status/classification/latency/timeframes/symbols/fallback/data-quality evidence, plus a safe migration.
- [x] Implement the read-only Binance/Kraken monitor and protected current/history dashboard, documenting verified Kraken mappings, intervals, freshness, request constraints, and unknown limits.
- [x] Deploy the authenticated scheduled callback, create the owner-level recurring provider-health schedule, verify its first evidence record, and run full test, TypeScript, and production-build validation without touching protected product behavior.
- [x] Perform a read-only Manus hosting/WebDev billing-usage, scheduled-job, persistence, and Preview-versus-production diagnosis; report only the required owner action and do not invoke the provider monitor.
- [x] Audit and document the existing Opportunity Engine, scoring, technical indicators, market regime, providers, Paper Trading, Research Lab, navigation, chart infrastructure, and tests; publish an internal implementation map before changes.
- [x] Add a data-bound Asset Intelligence and score-explainability layer that derives positive, neutral, risk, and unavailable evidence from existing scanner/technical/regime values without changing the Opportunity Score formula or thresholds.
- [x] Present existing technical, multi-timeframe, chart, risk, market context, catalyst-unavailable, provider, timestamp, data-quality, and provenance information with explicit unavailable states and no fabricated values.
- [x] Unify asset drill-down entry points across Dashboard, Scanner, Paper Trading, and relevant Alerts; reuse existing paper-only confirmation and immutable entry snapshots without changing execution logic.
- [x] Improve the existing Research Lab inspection experience into a responsive workspace using persisted experiment data only, without starting experiments or changing methodology.
- [x] Add traceability, no-mutation, navigation, snapshot, responsive-layout, and unavailable-data tests; run the full suite, TypeScript, production build, publish, and report remaining limitations.
- [x] Audit and document the current Paper Trading engine, portfolio/trade snapshot fields, navigation, and all information-dense dialogs before implementing Paper Trading 2.0 or workspace changes.
- [x] Add read-only, data-bound portfolio metrics, equity-curve derivation, open-position/current-state comparison, and trade-detail contracts from existing immutable records without duplicating trading logic or fabricating values.
- [x] Build a dedicated full-width Paper Trading workspace with portfolio dashboard, simulated-only entry confirmation, open positions, trade history, filters, responsive mobile cards, and large immutable trade-detail inspection.
- [x] Reuse and display immutable entry snapshots for "Why this trade?" while clearly separating entry state from current live state and keeping real trading unavailable.
- [x] Audit and upgrade dense dialog/workspace UX across Paper Trading, Asset Intelligence, and Research results using responsive dimensions, internal scroll, clear navigation, and no content clipping.
- [x] Add deterministic tests for portfolio calculations, equity derivation, filtering, immutable snapshots, current-versus-entry separation, no-mutation boundaries, responsive UI states, full validation, publishing, and final reporting.
- [x] Perform a read-only repository, runtime, infrastructure, and Manus-dependency audit for a shared web/Windows/iPhone architecture.
- [x] Trace the authoritative state, API/authentication boundaries, live-data flow, Paper Trading, Research Lab, alerts, secrets, and scheduled server workloads without changing them.
- [x] Evaluate responsive web/PWA, Tauri, Electron, and native-mobile paths; document a phased recommendation, migration boundaries, risk register, and no-change audit report.
- [x] Produce a design-only API/Auth Portability Specification covering API origin/versioning, OIDC with PKCE, server-derived authorization, and a provider-independent scheduler adapter.
- [x] Specify design-only storage and notification adapters, canonical provider and feature contracts, PWA constraints, and least-privilege Tauri/release requirements without implementation.
- [x] Verify and deliver the Phase 1 specification without modifying code, schema, schedules, providers, authentication, dependencies, infrastructure, or production behavior.
- [x] Establish a no-regression baseline and implement a single configurable API-origin/version metadata boundary while keeping same-origin web behavior as the default.
- [x] Introduce server-side authentication, authorization, OIDC/PKCE-readiness, error-normalization, and public-versus-secret configuration abstractions without replacing current Manus authentication.
- [x] Route existing Manus scheduler, storage, and owner-notification integrations through provider-independent server adapters while retaining current production adapters and scheduled callback protections.
- [x] Formalize portable server contracts for Paper Trading, Asset Intelligence, and Research Lab without changing their authoritative calculations, records, or business rules.
- [x] Add focused tests, security checks, documentation, full validation, visual verification, and a reversible published Phase 1 release with no schema migration.
- [x] Audit the current client shell, mutations, workspaces, charts, and authentication flow for secure PWA and read-only-offline boundaries without changing business logic.
- [x] Add a versioned manifest, generated icons, Apple/iOS metadata, safe-area styling, conservative static-only service worker, and controlled update registration without caching authenticated API data.
- [x] Add an explicit offline/read-only presentation state with last-known timestamps and online-only guards for Paper Trading, alerts, settings, and Research Lab mutations.
- [x] Complete an iPhone/iPad-responsive UX pass for full-screen workspaces, Paper Trading, Asset Intelligence, Research Lab, charts, touch targets, semantics, and accessible status labels.
- [x] Add PWA/offline/cache/update/security tests and documentation, run full validation and browser/device-class checks, then publish a reversible Phase 2 release without Tauri, a native wrapper, a schema migration, or a new identity provider.
- [x] Audit and document the complete authorized Tauri Windows POC and Opportunities Intelligence scope, existing technical inputs, provider/timeframe limits, authentication constraints, and no-regression boundaries.
- [x] Complete the conditional Tauri launch check without creating a wrapper: the required secure authentication handoff remains blocked pending explicit OIDC/browser-handoff authorization; no filesystem, shell, process, local trade store, or desktop secret boundary was introduced.
- [x] Define and implement a separate explainable Setup Intelligence and risk/reward layer for validated scalping and swing inputs without modifying Opportunity/Regime scoring, thresholds, providers, Paper Trading rules, or real-trading prohibition.
- [x] Add Opportunities navigation, Scalping/Swing setup workspaces, multi-timeframe evidence, risk/target/invalidation states, server-authoritative simulated trade monitoring, and responsive web/desktop UX without fabricated levels or probabilities.
- [x] Add deterministic methodology/regression tests, run complete validation, and report the Tauri authentication blocker honestly; desktop configuration tests are not applicable because no wrapper was safely created.
- [x] Audit and document the authorized 15M Scalping and Swing scope, existing validated technical inputs, Paper Trading snapshots, and non-negotiable no-change boundaries for scores, providers, alerts, research, and real trading.
- [x] Define additive server contracts for explainable setup plans, Trade Setup Quality, entry/target/stop/invalidation availability, target progress, Trade Health, immutable entry evidence, and current-state monitoring without creating a new Opportunity or Regime score.
- [x] Implement validated 15M/1H/4H Scalping and 1H/4H/1D Swing intelligence from existing server inputs only, with explicit unavailable/no-trade outcomes whenever a technical level or required data cannot be derived.
- [x] Integrate user-confirmed Paper Trading from a setup, immutable setup context at entry, separate current Trade Health, non-automated target events, and no automatic close, reversal, stop movement, or alert-logic change.
- [x] Add responsive Scalping, Swing, and monitoring workspaces with Asset Intelligence reuse, provenance/freshness, readable mobile/desktop layout, deterministic tests, full validation, and a reversible published release.
- [x] Audit the existing Scalping/Swing NO TRADE paths and capture the exact validated evidence available for every required setup condition without changing decision rules.
- [x] Add a read-only per-condition diagnostic contract and aggregate failure summary that identifies passed, failed, unavailable, and stale inputs with actual values and configured requirements where available.
- [x] Present a responsive "NO TRADE — WHY?" inspector for every Scalping/Swing result, including transparent no-data and stale-data states, without adding trade actions or modifying setup eligibility.
- [x] Add deterministic tests and no-change regression coverage, run full test/TypeScript/build validation, report the live diagnostic totals and top NO TRADE causes, then stop.
- [x] Perform a read-only inventory of all configured, fallback, available-but-unused, unsupported, and blocked market-data providers, including runtime/provider-health evidence and repository integrations.
- [x] Diagnose the Binance HTTP 451 response and audit Kraken, CoinGecko, and existing-provider support for coherent price, OHLCV, timestamp, volume, symbol, timeframe, historical, and regional requirements.
- [x] Map the unchanged Scalping and Swing input requirements, freshness/closed-candle semantics, actual request counts, documented limits, symbol coverage, and lower-timeframe feasibility without modifying any provider or setup behavior.
- [x] Produce a cited, read-only provider-coherence report with a safe future fallback recommendation, exact NO TRADE diagnosis, scorecard, and explicit preservation of current false-signal safeguards; then stop without deployment.
- [x] Audit the existing live-provider, scanner, setup, provider-monitor, router, UI, and regression-test contracts; capture a protected baseline for Opportunity/Regime scores, Paper Trading, alerts, Research Lab, and scheduled jobs.
- [x] Define and implement a reusable server-side provider-bundle/data-quality contract that keeps every technical timeframe validated, explicitly categorized, provider-provenanced, cache-aware, and coherent without relaxing existing gates or introducing lower timeframes.
- [x] Extend Scalping/Swing setup responses and diagnostics with per-timeframe provider, timestamp, freshness, validation state, eligible/ineligible evidence, and explicit provider-coherence reasons while retaining existing entry, stop, target, R:R, and Trade Health methodology.
- [x] Add a compact read-only provider/data-status presentation in Scalping, Swing, and existing provider-health surfaces without exposing secrets, moving provider calls to the browser, or changing scheduled monitor behavior.
- [x] Add deterministic provider/data-quality, setup, protected-regression, UI, secret/cache, TypeScript, build, and controlled live-validation coverage; publish only after all checks pass and report any remaining NO TRADE outcomes honestly.
- [x] Perform a read-only production baseline audit for deployment/version markers, runtime/service availability, domain routing, API health, build identity, environment exposure boundaries, database reachability evidence, and scheduler state.
- [x] Determine whether the available managed hosting controls can safely restore the current published service; do not alter application architecture, credentials, deployment settings, schedules, or infrastructure blindly.
- [x] If production is confirmed current and running, verify legacy and v1 tRPC contracts, public/protected access boundaries, scanner, Asset Intelligence, Scalping/Swing, Paper Trading rejection/protection, and no-trade behavior without creating a Paper Trade.
- [x] If production is confirmed current and running, record read-only live evidence for BTC, ETH, SOL, AAVE, and DOT across validated Scalping/Swing timeframes, including provider, response/freshness/candle quality, coherence, technical state, result, and actual Binance-to-Kraken behavior if observed.
- [x] Perform production browser-only responsive/PWA verification and report the exact hosting blocker, external action, or full validation evidence; stop without unrelated implementation changes.
- [x] Audit the existing setup-plan, Paper Trade snapshot, Trade Health, monitoring-event, router, workspace, and PWA contracts; capture a protected baseline for scores, providers, schedules, alerts, research, and core accounting.
- [x] Design additive server-authoritative interpretation contracts for QUALIFIED/WATCH/NO TRADE, ranked existing Opportunity Score presentation, target-path health, and immutable entry-versus-current trade monitoring without a secondary score or fabricated technical levels.
- [x] Implement explainable setup ranking, Watch/near-setup evidence, target-path intelligence, and useful no-qualified-setups aggregation for Scalping and Swing using only the existing coherent validated bundles and timeframes.
- [x] Extend Paper Trading additively with immutable setup snapshots, separate current Trade Health/target progress, manual refresh-only monitoring, and presentation-only health/strategy filters while preserving core accounting and prohibiting automatic actions.
- [x] Enhance full-width responsive Scalping, Swing, and Paper Trading workspaces with accessible health, data-quality, entry/stop/target, chart-evidence, offline-read-only, and mobile stacked-card presentation.
- [x] Add deterministic Phase 4 setup, target, Trade Health, snapshot-immutability, provider-coherence, PWA/security, and protected-regression tests; run full tests, TypeScript, production build, secret/cache scans, controlled production smoke validation, document exact outcomes, and publish only when checks pass.
- [x] Audit the existing manifest, service worker, PWA status, mobile navigation, dialogs, Asset Intelligence, Scanner, Scalping, Swing, Paper Trading, safe-area CSS, authenticated-route behavior, and protected no-change baseline.
- [x] Implement a truthful PWA connection/data-availability status contract that distinguishes network connectivity from live data availability, retains server-provided freshness/provenance, and preserves offline read-only mutation blocking.
- [x] Harden iPhone/iPad browser-class responsive layouts, safe areas, touch targets, modal viewport constraints, navigation, typography, scanner cards, and high-priority workspaces without changing trading, provider, scoring, or research behavior.
- [x] Add deterministic tests for manifest/metadata, service-worker cache boundaries/versioning, connection state, offline/reconnect controls, safe areas, modal/mobile constraints, accessible status labels, PWA security, protected routes, and no-secret/no-real-trading boundaries.
- [x] Run full tests, TypeScript, production build, static secret/cache checks, local browser-class offline reload/online-recovery checks, mobile/landscape/tablet screenshots, and read-only production smoke validation; document Safari/device limits truthfully and publish only when checks pass.
- [x] Perform a documented stop-or-go discovery audit of Binance, Kraken, and any trustworthy alternative for real 1m/3m/5m OHLCV, volume, timestamps, continuity, depth, symbol mapping, regional/API reachability, and legal/operational constraints.
- [x] Map the current protected shared-timeframe, provider-coherence, Scalping, Paper Trading snapshot, Trade Health, routing, UI, test, and PWA contracts; design an isolated low-timeframe Scalping-only contract with no Opportunity/Regime/Swing/fallback-policy changes.
- [x] Only if discovery validates a coherent single-provider 1m/3m/5m bundle, implement server-authoritative low-timeframe acquisition, strict validation, provenance/freshness, cache-aware request bounds, and explicit VALID/PARTIAL/STALE/MISSING/INCOHERENT failure states without provider mixing or synthetic candles.
- [x] Only if validated data is available, implement separate Scalping Intelligence ranking, alignment, entry/stop/technical-target/target-path/Trade Health interpretation and immutable user-confirmed Paper Trading snapshots without changing existing Scalping status rules, Swing, or automatic-action boundaries.
- [x] Present low-timeframe Scalping evidence, provenance, NO TRADE causes, data status, and responsive mobile/PWA cards without client-side provider calls or horizontal overflow; preserve online-only Paper Trading controls.
- [x] Add deterministic provider/data-quality, alignment, levels, R:R, target path, health, snapshot, security, protected-regression, TypeScript, build, cache, and production validation coverage; document accepted scope or the exact provider blocker and publish only after all checks pass.
- [x] Audit the published Phase 6 low-timeframe architecture, existing provider integrations, protected boundaries, and current production HTTP 403 baseline without modifying behavior.
- [x] Research each technically plausible independent single-provider candidate for native 1m/3m/5m OHLCV, coverage, volume, timestamps, authentication, rate/geographic constraints, production/server suitability, and live terms.
- [x] Run bounded read-only production reachability and data-quality checks for documented candidates across BTC, ETH, SOL, AAVE, and DOT; retain exact HTTP/provider/error evidence with no orders, settings, alerts, schedules, or Paper Trades.
- [x] Qualify a provider only if its complete native single-provider 1m/3m/5m bundle passes production validation, or preserve explicit NO TRADE — DATA UNAVAILABLE if no provider qualifies; never introduce mixed timeframes, synthetic candles, or unauthorized fallback.
- [x] Add only necessary isolated provider-state/UI documentation and regression coverage while preserving core scoring, established Scalping/Swing, Paper Trading rules, PWA caching, scheduler, authentication, and schema boundaries.
- [x] Run full tests, TypeScript, build, security/cache checks, controlled production validation, provider qualification matrix, documentation, and publish the Phase 7 result or exact stop blocker.
- [x] Audit current Swing/Scalping setup, provider/data-quality, Opportunity/Regime, Paper Trading, Trade Health, Asset Intelligence, router, UI, PWA, and test contracts; establish an unchanged protected baseline and confirm no migration/provider/authentication change is required.
- [x] Design an isolated deterministic setup-maturity and decision-interpretation contract mapping existing validated evidence to QUALIFIED, POTENTIAL, WATCH, NO TRADE, or DATA UNAVAILABLE without changing Opportunity/Regime formulas, existing methodology, or entry rules.
- [x] Implement server-authoritative Swing discovery interpretation, ranking, reasons, upgrade conditions, RISK OFF discovery restriction, and read-only Scalping DATA UNAVAILABLE preservation without new provider calls, provider mixing, synthetic data, or Paper Trade eligibility expansion.
- [x] Add responsive Opportunity Discovery and Asset Intelligence setup presentation with accessible status labels, deterministic reasons, conditional-only potential/watch triggers, no fake entries/targets, online-only qualified Paper Trading path, and PWA-safe mobile layout.
- [x] Add deterministic decision-state, RISK OFF, R:R, stale/provider/mixed-data, no-fake-entry, Paper Trading authorization, Trade Health, score/methodology, PWA/cache, authentication, and existing Swing/Scalping regression coverage.
- [x] Run full validation, controlled read-only local and production evidence checks, mobile/PWA visual verification, documentation, TODO review, checkpoint publication, and an exact Phase 8 result/blocker report with no artificial trades or data manipulation.
- [x] Audit the Phase 8 discovery/readiness, setup-plan, Trade Health, Asset Intelligence, Scalping/Swing, Paper Trading, router, PWA, provider, and score contracts; establish a protected baseline and confirm no migration, credential, policy, or authorization change is required.
- [x] Define a documented additive Setup Readiness methodology and transparent status hierarchy using only existing validated evidence, preserving fail-closed data blockers, Qualified/Potential/Watch separation, existing Opportunity/Regime scores, and Paper Trading eligibility.
- [x] Implement server-derived readiness score/state, deterministic working/missing/confirmation/invalidation explanations, conditional entry-zone/target-path/invalidation/R:R availability, current data provenance, and future-disabled potential-alert eligibility without new provider calls, synthetic data, or automatic actions.
- [x] Enhance Opportunity Discovery, Asset Intelligence, Swing, Scalping, and Paper Trading presentation with filters/sort disclosure, readiness, conditional plans, targets/progress/health, qualified-only Paper Trading controls, unavailable reasons, and responsive offline-safe PWA layout.
- [x] Add at least twenty meaningful deterministic readiness, status, target/invalidation, R:R, stale/missing/mixed-data, Trade Health, qualified-only Paper Trading, score/provider/alert regression, PWA/cache, authentication, and no-automatic-action tests.
- [x] Run full validation and controlled local/production API evidence checks for BTC, ETH, SOL, AAVE, and DOT; document exact provider/timeframe/timestamp/status/readiness/plan availability results, publish, and report any hosting or data blockers truthfully.

## Phase 10B — Authorized Persistence continuation

- [x] Add authenticated Setup Monitor workspace navigation to the PWA secondary menu and Home event routing.
- [x] Add PWA contract assertions for server-derived Setup Monitor reads, online-only mutations, owner filtering, deduplication, and no browser provider calls.
- [x] Run focused Setup Monitor, PWA, and Paper Trading regression tests.
- [x] Run the complete Vitest regression suite across the repository.
- [x] Run TypeScript validation and production build.
- [x] Document Phase 10B persistence tables, immutable snapshots, lifecycle state machine, event deduplication, authorization boundary, and validation evidence in scalping-swing-intelligence.md.
- [x] Perform bounded local persistence validation without fabricating or inserting test data: deterministic service tests cover save/refresh/original-current separation/event deduplication, the additive tables are present with zero rows, and the protected route returns HTTP 401 without a session.
- [x] Perform read-only production smoke validation after checkpoint propagation attempt: published shell returned HTTP 200, while both Setup Monitor procedures returned HTTP 404 NOT_FOUND, so the release is not yet exposed by the published router; no sign-in, mutation, trade, alert, or setting change was attempted.
- [x] Save and publish the Phase 10B implementation checkpoint after reviewing this checklist; the post-checkpoint smoke completion is tracked separately below.


## Phase 10C — Production Deployment & Setup Monitor Verification

- [x] Verify the intended production checkpoint and compare deployed artifact/version with local checkpoint fad748a8: local HEAD is fad748a8; production initially lagged, then exposed the same Setup Monitor router after deployment propagation, with no source change required.
- [x] Discover actual production tRPC API origins and verify all implemented Setup Monitor procedure paths without inventing names: all six implemented procedures are reachable under both /api/trpc and /api/v1/trpc; unauthenticated calls return 401 rather than 404.
- [x] Determine the evidence-supported cause of the earlier production 404 response: it was a stale/not-yet-propagated published runtime; after propagation, the same paths returned the expected authentication response.
- [x] Run safe authenticated read-only Setup Monitor verification: connected production browser rendered the authenticated workspace with empty Active setups and History states; unauthenticated API access returned 401; cross-user isolation remains covered by owner-scoped service logic and deterministic authorization tests, while no second production user was available for a live cross-user probe.
- [x] NO VALID SETUP AVAILABLE FOR CREATION TEST: the current production evidence was RISK OFF with provider/data-quality blockers and no eligible Potential, Qualified, or Watch setup was available; no fabricated setup was created.
- [x] Verify persistence contracts without fabrication: additive tables are present, deterministic lifecycle tests cover original/current separation, provenance, timestamps, and event deduplication; no natural state transition occurred during the read-only production window.
- [x] Verify Paper Trading, PWA/service-worker, multi-device, database, security, and cache boundaries without mutations: production Paper Trading routes return 401 unauthenticated, PWA contract passes, static-shell-only cache rules remain intact, and read-only DB counts show Setup Monitor rows 0 with existing datasets untouched.
- [x] Run focused/full tests, TypeScript, production build, and existing security/cache checks without changing the baseline: 61 focused tests, 242 tests across 43 files, TypeScript pass, production build pass, client secret/provider scan pass, real-action scan clean, and PWA contract pass.
- [x] Production deployment propagation completed for the existing Phase 10B checkpoint without source, schema, router, authentication, provider, scoring, Paper Trading, scheduler, alert, or Research Lab changes; production now returns the expected protected API responses.
- [x] Produce the Phase 10C final report using VERIFIED, NOT VERIFIED, BLOCKED, or NOT APPLICABLE for every requested item; limitations are explicitly labeled rather than inferred.


## Phase 11 — Live Setup Monitoring & Trade Health Intelligence

- [x] Audit the Phase 10C repository, checkpoint, Setup Monitor persistence, state machine, provider/data-quality, scoring, PWA, Paper Trading, and protected boundaries.
- [x] Define additive server-derived contracts for conditional trade plans, target paths, setup health, reversal risk, invalidation, provenance, and freshness.
- [x] Implement entry-zone, preferred-entry, confirmation, target, stop, R:R, target-progress, and health/reversal presentation layers without changing scores or provider policy.
- [x] Extend authenticated Setup Monitor refresh/detail presentation and Discovery/Scalping/Swing surfaces without adding automatic actions.
- [x] Preserve immutable originals, separate current state, event deduplication, owner-only access, and no automatic Paper Trades or alerts.
- [x] Preserve PWA static-shell-only caching, online-only mutations, offline read-only behavior, and multi-device server authority.
- [x] Add deterministic tests for valid, insufficient, stale, invalidated, target-reached, reversal-risk, progress, and deduplication paths.
- [x] Run focused/full tests, TypeScript, production build, security scans, PWA/cache scans, and responsive visual verification.
- [x] Document Phase 11 exact logic, evidence/provenance rules, limitations, and stop conditions.
- [x] Save and publish the validated Phase 11 checkpoint only after all completed items are marked [x].


## Phase 12 — Crypto Hub UX Reorganization and Responsive Redesign

- [x] Audit the current sidebar, dashboard, scanner, Discovery, Asset Intelligence, Scalping, Swing, Setup Monitor, Paper Trading, Research, Alerts, Settings, health views, mobile navigation, dialogs, tables, cards, and empty/loading/error states.
- [x] Define shared navigation groups, semantic status tokens, reusable Opportunity Card contract, Trade Health presentation, and responsive layout rules.
- [x] Consolidate desktop navigation into Home, Trade, Analysis, Research, Monitor, and System groups without deleting functionality.
- [x] Consolidate mobile navigation into a primary-plus-secondary pattern with clear access to all required workspaces.
- [x] Redesign Dashboard as a control center with regime, top opportunities, authenticated active-setup count, and clear Scalping/Swing/Paper Trading workspace access using server-derived data only; Paper Trading balances remain in its protected workspace to avoid side-effectful portfolio initialization.
- [x] Introduce and reuse a standardized Opportunity Card across Dashboard, Scanner, Scalping, Swing, and Asset Intelligence without fabricating levels or changing eligibility.
- [x] Standardize status colors, text labels, health states, no-trade explanations, unavailable-data states, and accessibility contrast.
- [x] Improve Scalping, Swing, Setup Monitor, Paper Trading, Research Lab, Alerts, Watchlist, Settings, health, dialogs, and tables for responsive desktop/tablet/mobile use.
- [x] Preserve authentication, owner-scoped access, PWA static-shell-only caching, offline read-only behavior, Paper Trading rules, alerts, schedules, scoring, providers, Research Lab calculations, and real-trading prohibition.
- [x] Add deterministic UI/contract tests for navigation, shared statuses, no-trade/unavailable semantics, server-derived levels, and protected actions.
- [x] Run full tests, TypeScript, production build, security/cache scans, and desktop/tablet/mobile visual verification.
- [x] Document Phase 12 IA, shared components, responsive decisions, accessibility, limitations, and unchanged business boundaries.
- [x] Save and publish the validated Phase 12 checkpoint only after all completed items are marked [x].


## Phase 13 — Paper Trading Summary, Watchlist, and Performance

- [x] Audit checkpoint 0eef49a5, current Dashboard/auth/Paper Trading contracts, Watchlist-related APIs/settings, PWA boundaries, and the full Phase 13 specification.
- [x] Decide whether an existing safe server-authoritative Watchlist read/mutation contract exists; the existing nullable userSettings.watchlist field was safe to extend additively, so no migration was required.
- [x] Add a protected read-only Paper Trading Dashboard summary using authoritative existing API values, with authenticated, empty, failure, and retry states; reads never initialize a portfolio.
- [x] Add a dedicated Watchlist workspace through the existing userSettings-backed server-authoritative contract, with canonical asset selection, owner scoping, online-only mutations, and no responsibility overlap.
- [x] Preserve authentication, ownership, offline read-only behavior, Paper Trading rules, alerts, schedules, scoring, providers, Research Lab, Setup Monitor, and real-trading prohibition.
- [x] Optimize frontend loading/code-splitting without changing runtime business logic or data authority through lazy workspace imports and stable Vite vendor chunks.
- [x] Add deterministic tests for summary auth/empty/failure states, Watchlist validation/ownership/mutations if supported, and performance/PWA boundaries; focused PWA/Paper Trading/Settings tests passed 25/25.
- [x] Run focused/full tests, TypeScript, production build, security/cache scans, bundle/performance checks, and desktop/tablet/mobile visual verification.
- [x] Document Phase 13 implementation, limitations, Watchlist decision, and unchanged protected boundaries.
- [x] Save and publish the validated Phase 13 checkpoint only after all completed items are marked [x].


## Phase 14 — Complete UI/UX Redesign + Multi-Device Experience + Scalping/Swing Discovery
- [x] Audit checkpoint 60566ab5, current UI architecture, themes, navigation, PWA, Opportunity Card, Scalping/Swing engines, provider/data-quality boundaries, and the complete Phase 14 specification.
- [x] Define a premium terminal IA, dark/light theme contract, responsive shell, shared status vocabulary, and server-derived Opportunity Card evidence contract.
- [x] Simplify desktop and mobile navigation without deleting functionality or weakening authentication/ownership boundaries.
- [x] Implement first-class persisted dark/light mode with system preference fallback, accessible contrast, semantic status colors, and readable charts/tables/badges.
- [x] Redesign Dashboard around market regime, top opportunities, Scalping/Swing snapshots, active monitoring, Paper Trading, data quality, and clear empty/error states.
- [x] Upgrade Opportunity Card to show only server-derived direction, scores, readiness, health, timeframe, data quality, provider, freshness, levels, R:R, progress, invalidation distance, and rationale.
- [x] Implement the controlled Scalping data ladder without relabeling 15M as 1M/3M/5M and without weakening provider/data validation.
- [x] Add the separate validated 15M Fast Scalp presentation only where existing 15M evidence is eligible, with explicit fallback labeling and fail-closed unavailable states.
- [x] Improve Swing discovery with practical filters, setup readiness, health/progress, no-trade explanations, and mobile/desktop responsive flows without changing scoring or status rules.
- [x] Preserve Paper Trading, Setup Monitor, Alerts, Research Lab, scheduler, historical data, provider provenance, PWA cache/offline, and real-trading prohibitions.
- [x] Add deterministic tests for themes/navigation, Opportunity Card evidence, data-ladder/fallback semantics, Swing discovery, protected actions, and PWA boundaries.
- [x] Run full tests, TypeScript, production build, security/provider/real-action scans, PWA/cache checks, accessibility checks, bundle/performance checks, and desktop/tablet/mobile visual verification.
- [x] Document Phase 14 implementation, limitations, exact data-ladder behavior, and unchanged protected boundaries.
- [x] Save and publish the validated Phase 14 checkpoint only after all completed items are marked [x].


## Phase 15 — Adaptive Trading Intelligence + Auto Paper Trial

- [x] Audit checkpoint 5bf35ca4, the full Phase 15 specification, scoring/provider/data-quality rules, Paper Trading, Setup Monitor, alerts, scheduler, PWA, and real-trading boundaries.
- [x] Define additive qualification states, trading modes, market-condition labels, setup-quality components, warnings, and server-authoritative evidence contracts without changing canonical scores or thresholds.
- [x] Implement adaptive presentation that distinguishes valid weak-market opportunities from invalid/missing/stale/incoherent data and remains fail-closed.
- [x] Implement the isolated Scalping ladder and separately labeled 15M FAST SCALP behavior without relabeling 1M/3M/5M data or adding provider mixing/resampling.
- [x] Add server-derived entry zones, stops/invalidation, variable target paths, R:R, progress, setup quality, rationale, and warnings only when validated evidence supports them.
- [x] Implement AUTO PAPER as simulation-only, explicitly gated, server-authoritative, owner-authenticated, immutable, and never connected to exchange or real-order APIs.
- [x] Extend Dashboard, Discovery, Scalping, Swing, Setup Monitor, Paper Trading, and mobile UX with adaptive states, modes, health, progress, and evidence without automatic real actions.
- [x] Preserve authentication, ownership, PWA offline read-only behavior, alerts, schedules, Research Lab, historical data, provider provenance, and existing Paper Trading economics.
- [x] Add deterministic tests for adaptive states/modes, weak-market warnings, invalid-data fail-closed behavior, 15M fallback, AUTO PAPER safeguards, and no-real-trading boundaries.
- [x] Run full tests, TypeScript, production build, security/provider/action scans, PWA/cache checks, performance checks, and desktop/tablet/mobile visual verification.
- [x] Document Phase 15 exact logic, simulation limits, data limitations, and unchanged production boundaries.
- [x] Save and publish the validated Phase 15 checkpoint only after every completed item is marked [x].


## Phase 15A — Adaptive Trading Intelligence + Auto Paper Trials

- [x] Audit the authorized Phase 15A specification and checkpoint 5bf35ca4 architecture, including scoring, providers, data quality, Paper Trading, Setup Monitor, alerts, scheduler, PWA, and real-trading boundaries.
- [x] Define additive schema, settings, trial, event, performance, ownership, and rollback contracts for simulation-only Auto Paper.
- [x] Generate and review the additive migration SQL, then apply only the explicitly authorized Phase 15A migration through the managed database migration path.
- [x] Implement server-derived Adaptive Setup Quality, market-condition labels, flexible modes, warnings, and qualification without changing existing canonical scores or provider policy.
- [x] Implement the controlled 1M/3M/5M to 5M to 15M FAST SCALP ladder without relabeling data, mixing providers, resampling, or weakening validation.
- [x] Implement server-derived trade plans with valid entry zones, stops/invalidation, up to three evidence-backed targets, R:R, reasons, warnings, and holding horizon.
- [x] Implement authenticated owner-scoped Auto Paper settings, default OFF, explicit enable/disable, risk sizing, direction/strategy filters, and position limits.
- [x] Implement immutable Auto Paper trial snapshots, current-state monitoring, event deduplication, duplicate active-setup prevention, manual/auto separation, and performance aggregation.
- [x] Ensure Auto Paper can mutate Paper Trading simulation only and has no exchange, broker, real-order, or real-balance path.
- [x] Extend Dashboard, Discovery, Scalping, Swing, Setup Monitor, Paper Trading, Auto Paper Lab, and PWA/mobile surfaces with truthful adaptive states and controls.
- [x] Preserve authentication, ownership, offline read-only behavior, PWA cache restrictions, alerts, schedules, Research Lab separation, historical provenance, provider policy, and real-trading prohibition.
- [x] Add deterministic tests for adaptive qualification/modes, weak/Risk-Off handling, invalid data fail-closed behavior, 15M fallback, Auto Paper auth/ownership, snapshots, events, deduplication, balance isolation, manual/auto separation, and no-real-order boundaries.
- [x] Run schema verification, focused/full tests, TypeScript, production build, security/provider/action scans, PWA/cache checks, performance checks, and desktop/tablet/mobile visual validation.
- [x] Document Phase 15A logic, migration, Auto Paper simulation limits, data limitations, and unchanged production boundaries.
- [x] Review the completed checklist and save/publish the validated Phase 15A checkpoint only after all items are marked [x].
- [x] Add Auto Paper Lab workspace with explicit OFF default, mode controls, active-trial metrics, and owner-scoped history.
- [x] Add protected server refresh and event-history procedures for Auto Paper monitoring.
- [x] Add desktop and mobile navigation access for Auto Paper Lab without changing existing workspace behavior.
- [x] Fix and validate the PWA mobile navigation module parser/import regression discovered during Phase 15A integration.

## Attached instruction execution

- [x] Review the attached Phase 15A instruction file and identify explicit implementation requirements.
- [x] Apply only the requested changes that are compatible with existing safety, authentication, data-quality, PWA, and real-trading boundaries. Authorized and completed with an additive independent Auto Paper account model; current Manual Paper portfolio remains untouched.
- [x] Validate and document the applied changes before publishing a new checkpoint.

## Phase 16 — Auto Paper Trading Lab & Adaptive Trade Lifecycle

- [x] Re-audit Phase 15A contracts against the authorized Phase 16 specification.
- [x] Add the authorized independent Auto Paper account model and migrate trials away from the shared Manual Paper portfolio without altering Manual Paper records.
- [x] Extend server settings, mode capture, automatic discovery, simulation entry, lifecycle, target milestones, health, and resumable data-unavailable behavior.
- [x] Add richer persisted-trial performance metrics, filters, Scalp-versus-Swing comparison, and chronological event feed APIs.
- [x] Expand Auto Paper Lab, Dashboard summary, Discovery, Scalping, Swing, and mobile controls with truthful adaptive evidence.
- [x] Add deterministic Phase 16 tests for authorization, accounting isolation, modes, automatic entries, lifecycle, performance, and no-real-order boundaries.
- [x] Run migration verification, full tests, TypeScript, production build, security/provider/action/PWA scans, production smoke checks, and responsive visual validation.
- [x] Document Phase 16 limitations and publish a validated checkpoint. Documentation complete and validated checkpoint published.

## Attached specification execution

- [x] Read and scope the newly attached specification.
- [x] Implement only compatible requested changes while preserving Auto Paper/Manual Paper isolation, data-quality gates, authentication, PWA boundaries, and real-trading prohibition.
- [x] Validate and document the resulting changes; publish the resulting changes after the final checklist review.

## Newly attached specification execution

- [x] Read and scope the newly attached specification.
- [x] Implement only compatible requested changes while preserving Auto Paper/Manual Paper isolation, data-quality gates, authentication, PWA boundaries, and real-trading prohibition. Explicit migration authorization was subsequently provided and the additive snapshot layer was completed.
- [x] Validate and document the resulting changes; publication is recorded under the Phase 18B checkpoint workflow.

## Phase 18 — Authenticated Production Validation & Equity History

- [x] Audit current Phase 17 Auto Paper account, performance, Lab, export, and lifecycle contracts against Phase 18.
- [x] Add the authorized owner-scoped immutable Equity Snapshot table and migration without changing Manual Paper records.
- [x] Persist deduplicated server-generated equity snapshots through the existing refresh/cron authority only.
- [x] Add snapshot-backed equity history, date ranges, drawdown, comparisons, and export metadata without fabricating points.
- [x] Add authenticated production-safe validation coverage and verify unauthenticated/cross-owner rejection. Authenticated browser diagnostic was read-only; clean unauthenticated requests returned 401.
- [x] Run full regression, TypeScript, production build, schema/security/PWA/action scans, restart, and responsive checks.
- [x] Document Phase 18 and publish a validated checkpoint. Phase 18B documentation is complete; final propagation verification found the published runtime stale and returning 404.
- [x] Complete preview/local Phase 18 validation and document that authenticated production validation is blocked by the missing Production sign-in control. Current Phase 18B source was checkpointed, but Production propagation remains blocked by the stale runtime.

## Latest attached specification execution

- [x] Read and scope the latest attached specification.
- [x] Implement only compatible requested changes while preserving authentication, data quality, PWA cache boundaries, Auto Paper/Manual Paper separation, and real-trading prohibition.
- [x] Validate and document the resulting changes; checkpoint `ad8e30d1` was published. Phase 18B remains INCOMPLETE because Production still returns 404 for the newly exposed procedures.

## Latest attached specification execution

- [x] Read and scope the latest attached specification.
- [x] Implement only the smallest compatible requested change while preserving authentication, data quality, PWA cache boundaries, Auto Paper/Manual Paper separation, and real-trading prohibition. Phase 18C used deployment synchronization only; no business logic or schema change was added.
- [x] Validate, document, and publish checkpoint `2d835753`; Production routes now return 401 unauthenticated under both API paths. Phase 18C remains INCOMPLETE because the current browser has no authenticated owner session for 200 verification.

## Phase 18C — Production Runtime Synchronization & Verification

- [x] Identify repository HEAD, intended checkpoint, actual production runtime marker, and deployment state. Intended Phase 18B checkpoint was `24550b3d`; the synchronized checkpoint is `2d835753`; Production HTML retains the prior PWA build marker but route behavior confirms the new procedures are deployed.
- [x] Republish the already-implemented Phase 18B runtime using the normal project deployment mechanism only; do not create a migration or change business logic.
- [x] Verify the complete `/api/trpc` and `/api/v1/trpc` unauthenticated matrix, honest empty states, Manual Paper isolation, PWA boundaries, and no-mutation safety. Authenticated matrix is pending an owner session; no mutation was attempted.
- [x] Stop and report if Production still serves the old runtime or returns 404 for any Phase 18B procedure. Routes no longer return 404; authenticated verification remains the exact blocker.

## Phase 19 — Professional Trading Terminal
- [x] Read and scope the latest attached specification.
- [x] Reduce primary navigation to Home, Markets, Opportunities, Scalp, Swing, Monitor, and Paper across desktop and iPhone.
- [x] Establish a responsive terminal shell with contextual workspace headers, risk-off warnings, and server-data freshness indicators.
- [x] Replace the static candle SVG with an interactive server-data candlestick chart supporting zoom, pan, crosshair, volume, EMA overlays, and Entry/SL/TP overlays.
- [x] Standardize OpportunityCard with status, scores, direction, setup, WHY, RISK, WARNING, DATA, and honest unavailable states across workspaces.
- [x] Upgrade Asset Intelligence into a comprehensive asset detail workspace with chart, trade plan, technical evidence, and provenance.
- [x] Present dedicated 15M Fast Scalp and Swing workspaces using existing server-authoritative setup/diagnostic data without changing gates.
- [x] Improve Markets, Monitor, Paper, Watchlist, and secondary research access around the seven-workspace IA.
- [x] Verify dark/light/system themes, iPhone/iPad/desktop responsiveness, accessibility, PWA offline read-only boundaries, and Manual/Auto Paper isolation.
- [x] Add or update Vitest coverage for Phase 19 UI contracts and chart interactions.
- [x] Validate, document, and publish a recoverable Phase 19 checkpoint or report the exact blocker. Full Vitest 272/272, TypeScript, production build, diff audit, and desktop/iPhone visual checks passed.

## Phase 20 — Trading Intelligence & Auto Paper Experiment
- [x] Audit existing server contracts for opportunity states, adaptive qualification, setup plans, Auto Paper modes, accounting, event history, performance, exports, and current UI workspaces.
- [x] Present server-derived QUALIFIED, POTENTIAL, WATCH, NO TRADE, and DATA UNAVAILABLE states without hiding Potential in RISK OFF regimes.
- [x] Add server-derived opportunity funnel counts and transparent disappearance reasons without changing scoring or gates.
- [x] Add display-only adaptive filters for status, strategy, direction, regime, health, and timeframe without changing scoring.
- [x] Clarify Auto Paper modes, eligibility labels, confirmation requirements, immutable trial boundaries, and Manual Paper separation without enabling Auto Paper by default.
- [x] Add measurable comparison views for Scalp/Swing, Qualified/Potential, Long/Short, and market regime using existing persisted Auto Paper data only.
- [x] Add a read-only Trading Journal view backed by existing Auto Paper lifecycle, event, accounting, and performance data; do not create trials on page open.
- [x] Add Phase 20 Vitest coverage for states, RISK OFF visibility, funnel derivation, filters, Auto Paper safety, journal read-only behavior, and no-real-trading boundaries.
- [x] Validate no migration, protected-system integrity, TypeScript, full tests, production build, responsive UI, PWA boundaries, and publish a recoverable Phase 20 checkpoint.

## Phase 21 — Trading Intelligence Analytics & Experiment Dashboard
- [x] Audit the Phase 21 analytics requirements against existing discovery, Auto Paper performance, history, coverage, and export contracts.
- [x] Extend Trading Intelligence with server-derived top summary metrics and a complete ALL ASSETS → CANDIDATES → WATCH → POTENTIAL → QUALIFIED → AUTO PAPER → ACTIVE → COMPLETED funnel.
- [x] Add truthful funnel conversion rates and server-derived rejection-reason presentation with insufficient-data handling.
- [x] Add Strategy, Timeframe, Sector, Status, Direction, and Regime comparison panels using existing server-returned or persisted data only.
- [x] Keep 15M Fast Scalp isolated from Swing 1H/4H/1D buckets and show sector data unavailable/unclassified states honestly.
- [x] Add historical coverage badges and sample-quality warnings without inventing samples, results, prices, or performance.
- [x] Add read-only journal export and funnel export using authenticated existing data boundaries; do not create schedules, alerts, trials, or snapshots automatically.
- [x] Add experiment dashboard and Auto Paper preset comparison without enabling Auto Paper or changing Auto Paper accounting.
- [x] Improve Intelligence Workspace hierarchy, responsive behavior, and readability across desktop/iPad/iPhone.
- [x] Add Phase 21 Vitest coverage for analytics derivation, insufficient-data behavior, export boundaries, isolation, and protected-system safety.
- [x] Validate no database migration, no protected-area changes, TypeScript, full tests, production build, PWA boundaries, and publish a recoverable Phase 21 checkpoint.

## Phase 22 — Auto Paper Live Simulation Engine
- [x] Audit the complete Phase 22 requirements against existing Auto Paper settings, eligibility, account, trial, event, refresh, performance, equity, export, and UI contracts.
- [x] Preserve the protected core: scoring, regime, readiness, qualification, provider/data-quality/freshness rules, Manual Paper, Research Lab, alerts, real trading, PWA, authentication, authorization, and Auto Paper accounting.
- [x] Keep Auto Paper OFF by default and require explicit authenticated owner confirmation before enabling simulation.
- [x] Expose a server-derived live Auto Paper eligibility count with ELIGIBLE, NOT_ELIGIBLE, DATA_UNAVAILABLE, REQUIRES_CONFIRMATION, and DUPLICATE semantics without creating trials while OFF.
- [x] Verify and present server-side eligibility across A/B/C/D modes, including 15M Fast Scalp isolation and Swing 1H/4H/1D boundaries.
- [x] Ensure automatic eligible setup discovery creates simulation trials only when Auto Paper is explicitly ON, with server-derived entry, stop, targets, R:R, sizing, risk controls, and immutable provenance.
- [x] Complete idempotent lifecycle monitoring for ACTIVE, HEALTHY, WARNING, REVERSAL_RISK, TARGET_1/2/3_REACHED, INVALIDATED, and COMPLETED states using current server data only.
- [x] Preserve independent Auto Paper accounting, max positions, available cash, realized/unrealized P/L, equity snapshots, and Manual Paper isolation.
- [x] Upgrade Auto Paper Lab and Journal with mode, eligibility, lifecycle, target progress, invalidation, data-unavailable, provenance, and no-look-ahead explanations.
- [x] Add Phase 22 Vitest coverage for activation, eligibility, idempotency, sizing, lifecycle, no-look-ahead, accounting isolation, authentication, and no-real-trading boundaries.
- [x] Validate no migration, protected-core integrity, TypeScript, full tests (295/295), production build, local 401/public 200 smoke, security scans, responsive UI, and publish a recoverable Phase 22 checkpoint; Auto Paper was not manually enabled and no trial was created for testing.

## Phase 23 — Auto Paper Control Center & Live Eligibility Intelligence
- [x] Audit Phase 23 requirements against existing Auto Paper settings, eligibility, account, trials, events, equity, performance, exports, PWA, and authentication contracts.
- [x] Build a clear Auto Paper Control Center summary for status, simulation-only boundary, equity, cash, active/completed trials, eligible now, and data unavailable.
- [x] Preserve explicit confirmation for Enable Auto Paper and safe Disable behavior; never enable automatically.
- [x] Add a live owner-scoped eligibility table/cards with asset, strategy, timeframe, direction, status, quality/readiness, Entry/SL/TPs, R:R, regime, health, provider, and freshness.
- [x] Present exact server-derived primary and additional reasons, separated into DATA BLOCK and STRATEGY BLOCK, without invented reasons.
- [x] Ensure Opportunity Card includes Auto Paper status while preserving honest unavailable values and existing Paper/Manual boundaries.
- [x] Add active simulation detail with original-versus-current plan, lifecycle, health, targets, risk, provenance, freshness, data quality, and full event timeline.
- [x] Add event filters for all required lifecycle events with duplicate-safe display and DATA_UNAVAILABLE/RESUMED semantics.
- [x] Present server-derived funnel stages, eligibility summary, Qualified/Potential/Risk Off visibility, Scalp/Swing and Long/Short comparisons, performance, equity, journal, and existing exports.
- [x] Validate owner scoping, protected 401 behavior, Manual Paper isolation, real-order isolation, PWA online-only mutations, lazy loading, accessibility, responsive desktop/iPhone, and Light/Dark/System themes.
- [x] Add Phase 23 Vitest coverage for eligibility/reasons/data-vs-strategy, lifecycle/events/resume, funnel/performance/equity/journal/exports, authentication/ownership/isolation/PWA/responsive contracts.
- [x] Run full tests, TypeScript, production build, security/provider/order/PWA scans, production smoke; publish a recoverable Phase 23 checkpoint without creating synthetic data or trials. Validation: 301/301 tests, clean typecheck/build/restart, local protected 401/public 200 checks, and desktop/iPhone previews; no trial or synthetic data created.
