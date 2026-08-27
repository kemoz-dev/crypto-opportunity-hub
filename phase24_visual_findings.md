# Phase 24 Visual Findings

## Deep-link verification

The asset-intelligence deep-link `/?workspace=asset-intelligence&assetId=bitcoin` opens the full-screen Asset Trade Investigation Workspace and loads live/server-returned Bitcoin evidence in the desktop preview. The desktop capture shows the Opportunity Score 67.6/100, CoinGecko market provenance, Binance Futures OHLCV, 4H timeframe, and the Asset Detail Workspace summary.

The first iPhone-class capture (`390x844`) exposed a responsive defect: the dialog content was clipped/positioned so that only its left portion was visible while roughly the right half of the dashboard remained visible behind the modal. The dialog was then changed to edge-to-edge `100dvh`/full-width positioning with a mobile scroll height. A follow-up 390px capture confirmed the workspace now covers the viewport correctly; when the network response is unavailable, it presents the honest `Asset Intelligence unavailable` state rather than fabricating evidence.
