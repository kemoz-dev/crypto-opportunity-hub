# Phase 19 visual validation notes

- Desktop preview at 1280×720: the primary rail and top workspace rail show Home, Markets, Opportunities, Scalp, Swing, Monitor, and Paper; the main title reads Command Center; data quality and provider status remain visible above the control center.
- iPhone-class preview at 390×844: the top header, market-regime banner, data-quality card, and control-center content remain readable; the fixed bottom navigation uses large touch targets and a horizontal strip so the seven primary destinations do not overlap. Longer labels are intentionally truncated within their own button bounds.
- Light theme contrast was corrected for cyan, emerald, amber, rose, and fuchsia semantic text used by live-data and warning panels.
- Preview runtime logs after the latest HMR updates show no current TypeScript or browser-console error. Earlier TransformError/HMR invalidate entries are historical and are not present in the latest log tail.
- The preview can legitimately show `UNAVAILABLE` when the current provider response is reconnecting; no fallback or fabricated market values were added.
