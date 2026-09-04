# V16 Room Guard Plan Amendment

This amendment supersedes Task 2 Step 3 of `2026-09-04-v16-official-planning-dashboard-notices.md`.

## Reason
Production already contains legacy room mappings where two groups in the same session share a room (for example M3/M4→D and M5/M6→A). Creating `UNIQUE(session_id, room)` immediately would fail the migration before Admin can reconcile those future rows.

## Approved replacement
- Do **not** create an immediate unique room index in this migration.
- Add deferred blocking constraint triggers for REAL and TEST room changes.
- The triggers use `pg_advisory_xact_lock` and reject `ROOM_TIME_CONFLICT` when two rows in the same session finish with the same room.
- Existing untouched legacy duplicate-room rows remain readable until explicit V16 reconciliation.
- A V16 week save submits all four groups and validates room uniqueness before persistence; after a session is saved through V16, duplicate rooms are impossible.
- The production reconciliation remains guarded and still requires explicit user approval before execution.

All other plan requirements remain unchanged.
