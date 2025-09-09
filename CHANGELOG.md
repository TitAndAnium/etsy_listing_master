## [Unreleased]
- Add: Fail Policy v1.0 geïntegreerd in validators + flow
- Add: Response uitgebreid met `overall_status`, `field_status`, `fail_reasons`, `policy_version`
- Add: Logging per veld met `fail_severity` en `policy_version`
- Docs: `docs/fail_policy_table_v1.md` toegevoegd en gelinkt vanuit README
- Tests: matrix‐dekkende Jest suite (`functions/__tests__/failPolicy.v1.test.js`)
- Credits: `defaultLimit()` leest `DAILY_CREDITS` op runtime; geen vaste constant meer.
- Testisolatie: `_resetTestState()` om in-memory creditsbuckets per test te resetten.
