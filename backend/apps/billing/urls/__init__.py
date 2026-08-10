"""URL routing package for the billing app (5.2 RC-2, 2026-08-09).

Submodules:
- ``billing`` — the authenticated billing API surface (create-checkout; 5.6
  adds status polling here).
- ``webhooks`` — the public Chargily webhook surface (kept out of the billing
  API namespace by design).
"""
