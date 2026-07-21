# Spine Pair Review — Algerian B2B Lead Platform V1

## Overall verdict

The pair is buildable as a downstream contract: flows, states, and tokens are committed with real values, and the PRD hard constraints (RTL, numerals, watermark, metering) are encoded as rules rather than aspirations. Two mechanical inconsistencies (one unresolved token reference, cross-spine component naming drift) need a fix pass before final; nothing structural.

## 1. Flow coverage — strong

UJ-1, UJ-2, UJ-3 all present verbatim with named protagonists, numbered steps, labeled Climax beats, and labeled Failure/edge paths. FR-to-surface closure table maps FR-5–FR-31; FR-1–FR-4 handled at chrome level.
### Findings
- (none)

## 2. Token completeness — adequate

28 color tokens all carry hex; typography/rounded/spacing/components fully valued; 13 contrast pairs verified. `{components.locale-switcher.height}` and all DESIGN prose references resolve.
### Findings
- **[medium]** `{spacing.4}` referenced in EXPERIENCE.md (Active-filter chips) is not defined in DESIGN.md frontmatter — only named layout deltas exist. *Fix:* add `4: 16px` to the spacing scale (Tailwind parity).
- **[medium]** Footer pair `muted-foreground` on `muted` absent from the verified contrast table and fails AA at ≈4.35:1 (cross-ref review-accessibility). *Fix:* darken link token; add pair to table.

## 3. Component coverage — thin

16 DESIGN.md components; 20 EXPERIENCE.md patterns. All components have real specs in at least one file, but cross-file names drift and EXPERIENCE claims a false 1:1 mapping.
### Findings
- **[medium]** Name mismatches: `filter-sidebar`↔Filter panel, `filter-chip`↔Active-filter chips, `checklist-card`↔Onboarding checklist card, `status-card`↔Chargily return status card, `banner`↔Failed-renewal banner, `reveal-button`↔Reveal control. *Fix:* EXPERIENCE patterns adopt DESIGN kebab-case names.
- **[medium]** `confirm-banner` (locale inference) has a DESIGN.md spec but no EXPERIENCE.md Component Patterns row. *Fix:* add the behavioral row.
- **[low]** App header, Upgrade dialog, Saved searches list, Billing sections, Verify-email gate, Account deletion flow have no DESIGN.md entries — acceptable as shadcn-inherited/composite, but EXPERIENCE's "map 1:1" claim must be softened to "or shadcn-inherited stock".

## 4. State coverage — strong

17 state rows cover every IA surface's applicable states (cold-load, loading, empty, error, truncated, rate-limited ×2, low/0-credit, already-revealed, 0-contacts, ledger-empty, webhook-pending, payment-failed, unverified, deletion-grace). Offline is intentionally unspec'd (no PRD requirement).
### Findings
- (none)

## 5. Visual reference coverage — informational

`mockups/` referenced from EXPERIENCE.md IA (4 files) but not yet rendered at review time — resolved by the Finalize mock step. `imports/` intentionally empty (founder assets deferred).

## 6. Bloat & overspecification — strong

Tables carry the load; DESIGN prose carries editorial voice (permitted); no PRD restatement beyond name references; no pixel specs outside token deltas.
### Findings
- (none)

## 7. Inheritance discipline — adequate

`sources` resolves; UJ names verbatim from PRD; FR numbers used as references only. Dragged down by the component-name drift and `{spacing.4}` (findings above).
### Findings
- (covered in §2/§3)

## 8. Shape fit — strong

DESIGN.md sections in canonical order (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts). EXPERIENCE.md has all required defaults plus five invented sections that earn their place (Trilingual & RTL, Credit Metering, Export Gating, Billing Reconciliation, Trust Surfaces).
### Findings
- (none)

## Mechanical notes

- EXPERIENCE.md frontmatter carried `status: final` prematurely; both files set final together at close of Finalize.
- `{date}` in subscription-chip strings is an intentional content placeholder, not a token reference.
