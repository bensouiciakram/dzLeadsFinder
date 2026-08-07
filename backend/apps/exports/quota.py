"""Daily export quota: the 5,000 rows/24h cap (FR-20, Q4 assumption).

The cap is a module constant (the SEARCH_DAILY_LIMITS precedent); the
ops-configurable `app_config` knob is deferred until the model exists
(recorded handoff). Reset at 00:00 Africa/Algiers is natural — the
`daily_usage` PK is (user_id, date) with `date = timezone.localdate()`
(AD-11).
"""

EXPORT_DAILY_ROW_LIMIT: int = 5000
