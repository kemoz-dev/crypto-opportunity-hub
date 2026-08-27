

## Phase 34 visual QA

- 390x844: Command Center, `/opportunities`, and `/decision` rendered without a crash or horizontal overflow. Market State, summary, filter controls, decision empty state, mobile navigation, and 44px-class controls remained visible. Live data was unavailable/loading, so no fabricated opportunity values appeared.
- 1440x900: Command Center, `/opportunities`, and `/decision` rendered without overflow. Desktop sidebar/navigation, market-state panels, summary cards, display-only filters, Decision Summary, Auto Paper auth boundary, and honest unavailable/loading states remained intact.
- QA limitation: the current preview had no live provider response, so Qualified/Potential/Watch card content and server-returned quality values could not be visually exercised with live rows; contract tests cover those states.
