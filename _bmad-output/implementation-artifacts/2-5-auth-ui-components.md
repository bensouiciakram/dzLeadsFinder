---
story_id: 2.5
epic: 2
title: Story 2.5 — Auth UI Components
status: review
frs: [FR-21, FR-22]
ads: [AD-10]
ux_drs: [UX-DR20, UX-DR21, UX-DR22, UX-DR23]
baseline_commit: efffaaf4bec7851fd98560fde7c7883b269eee12
---

# Story 2.5: Auth UI Components

Status: review

## Story

As a **user interacting with authentication screens**,
I want **polished, accessible, and fully localized signup, login, verify-email, and password-reset pages with validation and error states**,
So that **I can complete auth flows smoothly in my language**.

## Acceptance Criteria

1. **AC1: Signup page** (`/signup`) — email field with visible label (not placeholder-as-label), `autocomplete="email"`; password field with visible label, `autocomplete="new-password"`, stated minimum (8 chars); "Start free" CTA button (localized); "Already have an account? Log in" link; all fields have `aria-invalid` + `aria-describedby` on validation error.

2. **AC2: Login page** (`/login`) — email field with label, `autocomplete="email"`; password field with label, `autocomplete="current-password"`; "Log in" CTA button (localized); "Forgot password?" link; error summary on failed login (localized).

3. **AC3: Verify-email page** (`/verify-email`) — "Check your email" title (localized); instructions to click the verification link; "Resend verification email" link; 24h expiry notice; hard gate: no navigation to app surfaces until verified.

4. **AC4: Password-reset page** (`/password-reset`) — email field with label; "Send reset link" CTA button; confirmation screen on submit (not revealing if email exists); reset confirmation page with new password fields.

5. **AC5: Accessibility** — focus order follows visual order (including RTL); error messages announced via `aria-live="polite"`; all form fields have visible labels at all times; validation errors render inline per field before form-level summary.

6. **AC6: Trilingual support** — all strings, errors, and validation messages are in the active locale; direction (RTL/LTR) is correct for the locale; the locale switcher in the header works on auth pages.

## Tasks / Subtasks

- [x] **Task 1: Shared FormErrorSummary component** (AC5)
  - [x] 1.1 `frontend/src/components/auth/FormErrorSummary.tsx` — NEW client component: props `{ errors: { id: string; message: string }[] }` (`message` = next-intl key); renders `null` when the array is empty; container carries `aria-live="polite"` (AC5 literal — NOT `role="alert"`, which would force assertive); heading `common.errors.summary_title`; `<ul>` of anchors `href={'#' + id}` (jump-to-field error-summary pattern, GOV.UK-style); logical properties only (`ms-*`/`me-*`/`text-start`)
  - [x] 1.2 Anchor `id`s MUST exactly match the existing per-field error `<p id>` ids each form already renders (`*-email-error`, `*-password-error`, ...) so the anchors land on the inline errors

- [x] **Task 2: Signup form polish** (AC1, AC5)
  - [x] 2.1 `SignupForm.tsx` — add `auth.signup.password_requirements` note ("At least 8 characters") adjacent to the password field, below the input (mirror `PasswordResetConfirm`'s requirements-note placement at PasswordResetConfirm.tsx:132-134); satisfies "stated minimum (8 chars)"
  - [x] 2.2 `SignupForm.tsx` — wire `<FormErrorSummary errors={[{ id: 'signup-email-error', ... }, { id: 'signup-password-error', ... }]} />` rendered AFTER the fields and inline errors, BEFORE the CTA row (AC5 ordering); existing `aria-invalid`/`aria-describedby`/labels/autocomplete already present — do NOT touch
  - [x] 2.3 Copy (i18n values, keys unchanged): `auth.signup.submit` value → "Start free"; `auth.signup.login_link` value → "Log in" (AC1 literal — see Dev Notes decision 1)

- [x] **Task 3: Login form polish** (AC2, AC5)
  - [x] 3.1 `LoginForm.tsx` — wire `<FormErrorSummary errors={[{ id: 'login-email-error', ... }, { id: 'login-password-error', ... }]} />` after fields/inline errors, before the link+CTA row; `session_expired`/`password_reset` banners and the failed-login `role="alert"` root error stay untouched
  - [x] 3.2 Copy: `auth.login.submit` value → "Log in" (AC2 literal)

- [x] **Task 4: Verify-email gate polish** (AC3, AC5)
  - [x] 4.1 `VerifyEmailGate.tsx` — resend control becomes `Button variant="link"` (button.tsx:20 — visually a link, semantics remain a submit button since resend is an action, not navigation; the localized label `auth.verify.resend` = "Resend verification email" already matches the AC)
  - [x] 4.2 `VerifyEmailGate.tsx` — wire `<FormErrorSummary errors={[{ id: 'verify-email-error', ... }]} />`; keep the resend `role="status"` success + `role="alert"` failure messages
  - [x] 4.3 Copy: `auth.verify.gate_title` value → "Check your email" (AC3 literal — see Dev Notes decision 1)
  - [x] 4.4 Hard gate: enforcement already ships in the AD-19 interceptor (`authRedirectFor('email_not_verified') → '/verify-email'`, tested at `frontend/src/__tests__/http-client.test.ts:40-42,180-190`) — this story adds a PAGE-LEVEL test asserting the pre-verification gate renders NO navigation to app surfaces (no links at all; only the resend form)

- [x] **Task 5: VerifyLinkHandler resend summary** (AC3, AC5)
  - [x] 5.1 `VerifyLinkHandler.tsx` — wire `<FormErrorSummary errors={[{ id: 'expired-email-error', ... }]} />` into the expired-state resend form (after the inline error, before the resend button); success/used/expired/error states untouched

- [x] **Task 6: Password-reset request form** (AC4, AC5)
  - [x] 6.1 `PasswordResetForm.tsx` — wire `<FormErrorSummary errors={[{ id: 'reset-email-error', ... }]} />`; `sent_confirmation` anti-enumeration state, login link, and double-submit ref guard stay untouched
  - [x] 6.2 Verify CTA: `auth.password_reset.submit` = "Send Reset Link" already satisfies AC4's "Send reset link" — no change, note in completion

- [x] **Task 7: PasswordResetConfirm** (AC4, AC5)
  - [x] 7.1 `PasswordResetConfirm.tsx` — wire `<FormErrorSummary errors={[{ id: 'reset-new-password-error', ... }, { id: 'reset-confirm-password-error', ... }]} />` into the valid-state form; requirements note already adjacent (PasswordResetConfirm.tsx:132-134) — leave; state machine (loading/valid/done/expired/used/error + 410-after-success guard) untouched

- [x] **Task 8: i18n keys and values in all three locales** (AC1-AC6)
  - [x] 8.1 `frontend/messages/en.json` — value changes: `auth.signup.submit` "Create Account" → "Start free", `auth.signup.login_link` "Login" → "Log in", `auth.login.submit` "Login" → "Log in", `auth.verify.gate_title` "Verify your email to continue" → "Check your email"; NEW keys: `common.errors.summary_title` ("Please fix the following errors"), `auth.signup.password_requirements` ("At least 8 characters")
  - [x] 8.2 Mirror in `fr.json` + `ar.json` (Arabic for AR, French for FR) — `npm.cmd run check:i18n` must pass (en is the source of truth; 347 keys currently)
  - [x] 8.3 No hardcoded UI strings anywhere in the changed components

- [x] **Task 9: Frontend tests (TDD-first)** (all ACs)
  - [x] 9.1 `frontend/src/__tests__/form-error-summary.test.tsx` — NEW: renders nothing for empty array; renders heading key + anchor per error with correct `href="#<id>"`; container has `aria-live="polite"`
  - [x] 9.2 `frontend/src/__tests__/signup-form.test.tsx` — UPDATE: password requirements note renders adjacent to the password field; invalid submit shows summary (heading + per-field anchors, `aria-live="polite"`); inline per-field errors appear BEFORE the summary in DOM order; tab order is email → password → CTA (no errors)
  - [x] 9.3 `frontend/src/__tests__/login-form.test.tsx` — UPDATE: invalid submit shows summary; tab order email → password → forgot-password link → CTA
  - [x] 9.4 `frontend/src/__tests__/verify-email-gate.test.tsx` — UPDATE: resend renders as link-styled button (still `type="submit"` semantics via text + form behavior); invalid submit shows summary; gate renders NO links to app surfaces (`/search`, `/login`, `/billing`...) — only the resend form
  - [x] 9.5 `frontend/src/__tests__/verify-link-handler.test.tsx` — UPDATE: expired state resend form shows summary on invalid submit
  - [x] 9.6 `frontend/src/__tests__/password-reset-form.test.tsx` — UPDATE: invalid submit shows summary
  - [x] 9.7 `frontend/src/__tests__/password-reset-confirm.test.tsx` — UPDATE: valid-state form shows summary on invalid submit (mismatch + short password); requirements note present adjacent to new-password field
  - [x] 9.8 Tests assert message KEYS (next-intl mocked to return keys — setup.ts `mocks.ts`), never hardcoded English; RHF validation is async — `waitFor`/`findBy*`

- [x] **Task 10: Verification gates + story sync**
  - [x] 10.1 Frontend: `npm.cmd test` (130 existing + new green), `npm.cmd run lint` 0, `npm.cmd run typecheck` 0, `npm.cmd run check:i18n` parity green (347 + 2 keys ×3 locales)
  - [x] 10.2 Backend regression (no backend changes expected — 2.5 is a UI story): `.\.venv\Scripts\python.exe -m pytest` (117 green), `.\.venv\Scripts\ruff.exe check .` 0, `.\.venv\Scripts\mypy.exe .` strict 0 (from `backend/`)
  - [x] 10.3 Story file updated: tasks checked, File List complete, Change Log, status → review (dev-story) → done (code-review); sprint-status.yaml synced

## Dev Notes

### Decided constraints (confirmed with user)

- **Copy follows AC literal text (decision 1 — 2.4 precedent)**: AC wording is the story contract (2.4 used AC text verbatim for `sent_confirmation`). Value changes: `auth.signup.submit` → "Start free" (matches the EXPERIENCE.md Voice & Tone Start-free CTA row: ابدأ مجاناً / Commencer gratuitement / Start free), `auth.signup.login_link` → "Log in", `auth.login.submit` → "Log in", `auth.verify.gate_title` → "Check your email". Recorded deviation: the UX microcopy table (EXPERIENCE.md L103) worded the verify screen title "Verify your email"; AC3's "Check your email" wins — keys (`auth.verify.gate_title` etc.) are unchanged, only values.
- **Resend control (decision 2)**: AC3 says "Resend verification email" **link**; a resend is an action, not navigation, so the control stays a submit button styled as a link via `Button variant="link"` (button.tsx:20). The localized label already reads "Resend verification email".
- **Form-level summary (decision 3)**: new shared `FormErrorSummary` client component; the container carries `aria-live="polite"` per AC5 (NOT `role="alert"` — that forces assertive announcements and would double-announce with the fields' `aria-describedby`); heading `common.errors.summary_title`; anchors `href="#<field-error-id>"` jump focus to the inline error (classic error-summary pattern); rendered AFTER inline per-field errors and BEFORE the CTA row (AC5 ordering).
- **NO backend changes** — 2.5 is a UI story; every AC is client-side. The verified-email hard gate is enforced by the AD-19 interceptor (`authRedirectFor`) and stays there.
- **NO new dependencies** — TanStack Query stays deferred to Epic 3 (AD-20); no new libraries; zod stays v3 (^3.25, AD-18).
- **Keep existing behaviors**: all autocomplete tokens, labels, `aria-invalid`/`aria-describedby`, banners (`session_expired`, `password_reset`), root `role="alert"` errors, `role="status"` successes, double-submit guards, anti-enumeration states, and the VerifyLinkHandler/PasswordResetConfirm state machines are UNTOUCHED — the story only adds the requirements note (signup), the summary component wiring, the resend link styling, and i18n value changes.

### Existing patterns to follow (from stories 2.2/2.3/2.4)

- Forms: RHF + zodResolver (AD-18), schemas in `frontend/src/lib/validation/auth.ts` (unchanged), unnamespaced `useTranslations()`, message-key strings in schemas and components.
- Field pattern: visible `<label htmlFor>`, stable error `<p id>` ids (`<form>-<field>-error`), `aria-invalid={Boolean(errors.x)}` + `aria-describedby`, shared `inputClass` string.
- Page shells: server components with `generateMetadata` + `setRequestLocale` (login page wraps in `<Suspense>`; signup/password-reset do not) — NO page changes in this story.
- Vitest: `setup.ts` imports `mocks.ts` (next-intl returns keys; next/navigation stubs); axios-using components mock `@/lib/api/auth-service` (`vi.mock`), fetch-using components (SignupForm, VerifyEmailGate, VerifyLinkHandler) stub global `fetch`; RHF+zod validation is ASYNC — `waitFor`/`findBy*`; assertions on message KEYS, never values.
- Design tokens: `rounded-md border-border bg-card`, `text-small text-muted-foreground`, `text-destructive`, logical properties only (`ms-*`/`me-*`/`text-start`), NO physical properties (AD-2/AD-9).
- No code comments unless necessary; repo commit style `Story 2.5: ...` author `bensouici akram <bensouiciakram@gmail.com>` via `git -c user.name=... -c user.email=...`; do NOT push; user commits manually.
- Checkboxes `- [x]` stay unchecked until the dev story executes them — tasks above are the live checklist.

### Implementation notes

- `FormErrorSummary` props: `{ errors: { id: string; message: string }[] }` — `message` is the RHF `errors.x.message` i18n key, rendered via `t(message)`; `id` must equal the inline error `<p>` id. Callers map RHF error state, e.g.:
  `errors.email?.message ? { id: 'signup-email-error', message: errors.email.message } : null` filtered to non-null.
- Tab order contract (AC5): DOM order = visual order in both directions because the layouts are logical-property flex flows (flex-row flips visually in RTL while DOM order is unchanged — which IS the correct visual order). Tests assert DOM order of focusable elements via `container.querySelectorAll('input, a[href], button')`.
- The gate page (AC3 hard-gate page test): the rendered gate has zero `<a>` elements — assert `document.querySelectorAll('a').length === 0` (or scope to the card) plus the resend form present. VerifyLinkHandler's token page is a separate surface (post-verification states) and is NOT part of the gate.
- `auth.signup.password_requirements` mirrors `auth.password_reset.password_requirements` wording ("At least 8 characters" / "8 caractères minimum" / "8 أحرف على الأقل") — keep them parallel.
- Failed-login error summary (AC2): already implemented as the root `role="alert"` error (`auth.login.error_invalid` / `error_rate_limited` / `common.states.error` / `common.errors.network`); no change — the AC5 form-level summary covers client-side validation errors.

### Gotchas

- Windows/PowerShell: no `&&`; chain with `;` or `if ($?) {}`; use `npm.cmd` (npm.ps1 blocked); `python3` unavailable — use `python` for scripts, `.\.venv\Scripts\python.exe` for backend.
- Ruff line length 100; mypy strict annotations — backend untouched so gates should be regression-only (117/0/0).
- zod is v3 (^3.25) — do NOT bump.
- Summary anchors use plain `href="#id"` — next-intl/Link not needed; do NOT use next/link for in-page anchors.
- `role="alert"` on the summary would break the AC5 `aria-live="polite"` requirement — polite only.
- Do NOT touch the backend (`backend/` unchanged), the email system, the interceptor, or `http-client.ts` — the hard gate is already implemented and tested there.
- i18n parity: `npm.cmd run check:i18n` compares key SETS (en = source of truth) — value changes pass automatically as long as keys stay in sync across the 3 files.

### Project Structure Notes

- Frontend components: `frontend/src/components/auth/` (LoginForm, SignupForm, VerifyEmailGate, VerifyLinkHandler, PasswordResetForm, PasswordResetConfirm — all UPDATE except the NEW `FormErrorSummary.tsx`).
- i18n: `frontend/messages/{en,fr,ar}.json` — UPDATE values + 2 new keys each.
- Tests: `frontend/src/__tests__/` — 1 NEW (`form-error-summary.test.tsx`), 6 UPDATE (signup-form, login-form, verify-email-gate, verify-link-handler, password-reset-form, password-reset-confirm).
- No page files, no validation schemas, no service files change in this story.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-02-user-auth-account/story-05-auth-ui-components.md] Story spec (7 AC groups)
- [Source: _bmad-output/implementation-artifacts/2-4-password-reset-flow.md] Completed 2.4 — format precedent, AC-literal copy decision, gate patterns, test conventions
- [Source: docs/ARCHITECTURE-SPINE.md#L313-L325] AD-18 form stack (RHF+zod, i18n-key messages, aria-invalid/aria-describedby, requirements adjacent to field); #L329-L334 AD-19 interceptor (hard gate); #L347-L367 component tree (auth components)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-profitable-saas-service-2026-07-19/EXPERIENCE.md#L87-L108] Voice & Tone microcopy (Start-free CTA row; validation strings); #L184 forms AA floor (visible labels, autocomplete tokens, inline per-field errors + error summary on submit, aria-live, requirements adjacent); #L175 auth pages WCAG 2.1 AA
- [Source: frontend/src/components/auth/LoginForm.tsx] Banner pattern, RHF form pattern, failed-login root error
- [Source: frontend/src/components/auth/SignupForm.tsx] Current signup state (labels/autocomplete/aria present; missing requirements note + summary)
- [Source: frontend/src/components/auth/VerifyEmailGate.tsx, VerifyLinkHandler.tsx] Gate + resend patterns (button submit, role=status/alert states)
- [Source: frontend/src/components/auth/PasswordResetForm.tsx, PasswordResetConfirm.tsx] Reset patterns (requirements note placement at PasswordResetConfirm.tsx:132-134)
- [Source: frontend/src/components/ui/button.tsx#L20] `variant="link"` variant
- [Source: frontend/src/__tests__/http-client.test.ts#L40-L42,L180-L190] Hard-gate enforcement tests (existing)
- [Source: frontend/src/__tests__/{signup-form,login-form,verify-email-gate,verify-link-handler,password-reset-form,password-reset-confirm}.test.tsx] Test patterns (module mocks, async RHF, key assertions)

## Review Findings

_(to be filled by code-review — see 2-4-password-reset-flow.md for the established format: [Patch]/[Defer]/dismissed entries)_

## Dev Agent Record

### Agent Model Used

deepseek-v4-flash (opencode)

### Debug Log References

- **Summary duplicates break single-match queries**: the form-level summary renders each field's message key again, so any `getByText`/`findByText` on a validation message now throws "Found multiple elements". All affected assertions (signup/login/gate/link-handler/reset-form/reset-confirm) moved to `getAllByText`/`findAllByText` with exact counts — counts document the inline + summary contract (2 per field).
- **Tab-order test scope**: `querySelectorAll('input, a[href], button')` includes the below-CTA "login/signup link" — the DOM order IS the correct visual/tab order (logical flex flow), the expectation just had to include the trailing link (signup: email→password→CTA→login_link; login: email→password→forgot→CTA→signup_link).
- **Server field errors (email_taken / weak_password) also appear in the summary**: `setError('field')` sets `errors.field.message`, which the summary picks up — expected per AC5; tests assert 2 occurrences.
- `role="alert"` root errors (failed login, resend failure, POST 400) are NOT part of the polite summary — they are server/network failures, kept assertive by design.

### Completion Notes List

- `FormErrorSummary.tsx` (NEW): shared error-summary client component — `aria-live="polite"`, heading `common.errors.summary_title`, per-error anchor `href="#<field-error-id>"` jumping to the inline error; renders null when empty; logical-property tokens.
- Signup: `auth.signup.password_requirements` note adjacent to password field (AC1 stated minimum); summary wired (signup-email-error / signup-password-error); copy: `auth.signup.submit` → "Start free", `auth.signup.login_link` → "Log in".
- Login: summary wired (login-email-error / login-password-error); copy: `auth.login.submit` → "Log in"; forgot-password link, banners, root error untouched.
- Verify gate: resend now `Button variant="link"` (still a submit button — action, not navigation); summary wired (verify-email-error); copy: `auth.verify.gate_title` → "Check your email"; hard gate already enforced by the AD-19 interceptor (existing `http-client.test.ts` coverage) + NEW page-level test: the pre-verification gate renders zero `<a>` elements.
- VerifyLinkHandler expired-state resend form: summary wired (expired-email-error).
- PasswordResetForm: summary wired (reset-email-error); `auth.password_reset.submit` "Send Reset Link" already satisfied AC4 — unchanged.
- PasswordResetConfirm valid-state form: summary wired (reset-new-password-error / reset-confirm-password-error); requirements note already adjacent — unchanged.
- i18n: +2 keys ×3 locales (`common.errors.summary_title`, `auth.signup.password_requirements`) + 4 value changes ×3 → 349 keys/locale, parity green.
- Gates: frontend 145 tests green (130 + 15: 3 summary component, +12 across 6 updated suites), lint 0, typecheck 0, check:i18n 349×3 ✓; backend regression 117 pytest, ruff 0, mypy strict 0.
- NO backend changes; no new dependencies; no schema/service/page changes.

### File List

- `_bmad-output/implementation-artifacts/2-5-auth-ui-components.md` — NEW (this story file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE (2-5 → ready-for-dev → in-progress → review, last_updated)
- `frontend/src/components/auth/FormErrorSummary.tsx` — NEW (shared error-summary, aria-live="polite")
- `frontend/src/components/auth/SignupForm.tsx` — UPDATE (password requirements note, summary wiring)
- `frontend/src/components/auth/LoginForm.tsx` — UPDATE (summary wiring)
- `frontend/src/components/auth/VerifyEmailGate.tsx` — UPDATE (link-styled resend, summary wiring)
- `frontend/src/components/auth/VerifyLinkHandler.tsx` — UPDATE (expired-resend summary)
- `frontend/src/components/auth/PasswordResetForm.tsx` — UPDATE (summary wiring)
- `frontend/src/components/auth/PasswordResetConfirm.tsx` — UPDATE (summary wiring)
- `frontend/src/__tests__/form-error-summary.test.tsx` — NEW (3 tests)
- `frontend/src/__tests__/signup-form.test.tsx` — UPDATE (note, summary, order, tab-order tests; server-error duplicates)
- `frontend/src/__tests__/login-form.test.tsx` — UPDATE (summary + tab-order tests; duplicate counts)
- `frontend/src/__tests__/verify-email-gate.test.tsx` — UPDATE (link-styled resend, summary, hard-gate page test; duplicates)
- `frontend/src/__tests__/verify-link-handler.test.tsx` — UPDATE (expired-resend summary; duplicates)
- `frontend/src/__tests__/password-reset-form.test.tsx` — UPDATE (summary; duplicates)
- `frontend/src/__tests__/password-reset-confirm.test.tsx` — UPDATE (summary; duplicates)
- `frontend/messages/en.json` — UPDATE (2 new keys, 4 value changes)
- `frontend/messages/fr.json` — UPDATE (parallel)
- `frontend/messages/ar.json` — UPDATE (parallel)

## Change Log

- 2026-08-03: Story created (ready-for-dev) from epic 2.5 spec; decisions resolved (AC-literal copy values, resend = link-styled submit button, shared FormErrorSummary with aria-live="polite", no backend changes, hard gate already enforced by AD-19 interceptor — page-level test added); validated against checklist.
- 2026-08-03: Implemented (TDD): RED confirmed (21 failures + 1 missing-module suite) → FormErrorSummary + wiring across 6 auth components + i18n (2 new keys, 4 value changes ×3 locales) → GREEN 145 frontend tests (130 + 15), lint/typecheck/i18n clean; backend regression 117/0/0; status → review.
