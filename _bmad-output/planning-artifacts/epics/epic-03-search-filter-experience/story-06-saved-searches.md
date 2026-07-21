---
title: Story 3.6 — Saved Searches
story_id: 3.6
epic: 3
status: draft
frs: [FR-8]
ads: [AD-3]
ux_drs: [UX-DR20, UX-DR24]
---

# Story 3.6: Saved Searches

As a **user who runs the same searches repeatedly**,
I want **to save my current search (filters + keywords) with a name, see it in a sidebar list, and re-run it with one click**,
So that **I don't have to re-enter the same filter combinations every time**.

## Acceptance Criteria

**Given** the saved searches feature
**When** a user has staged a search they want to save
**Then** there is a "Save search" affordance that opens a naming prompt
**And** the user enters a free-text name
**And** the current filter + keyword + sort state is serialized to JSONB
**And** a `POST /api/search/saved/` creates the saved search

**Given** the saved searches list
**When** the user opens the filter sidebar
**Then** a "Saved searches" section lists all saved searches by name
**And** clicking a saved search re-runs it (one click = one query = counted toward daily limit)

**Given** search management
**When** the user right-clicks or uses the action menu on a saved search
**Then** they can rename or delete the saved search
**And** renaming does not re-run the query

**Given** cap enforcement
**When** a free user has 5 saved searches
**Then** the "Save" affordance is disabled with a tooltip: "Free tier limit: 5 saved searches"
**And** for Starter users the limit is 25

**Given** persistence across sessions and locales
**When** the user logs out and back in
**Then** all saved searches are available
**And** when the user switches locale, saved searches persist (filters still work; display names don't localize)

**Given** the saved search API
**When** I inspect the endpoints
**Then** the following exist:
- `POST /api/search/saved/` — create
- `GET /api/search/saved/` — list
- `PUT /api/search/saved/{id}/` — update (rename, filters)
- `DELETE /api/search/saved/{id}/` — delete
**And** saved search data is stored in the `saved_searches` table with user_id, name, type (people/company), filters (JSONB), sort (JSONB), created_at, updated_at

**Given** empty state
**When** no saved searches exist
**Then** a one-line hint is shown: "Save a search to reuse it later"
