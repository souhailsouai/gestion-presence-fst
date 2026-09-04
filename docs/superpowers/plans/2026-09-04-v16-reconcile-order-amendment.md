# V16 Production Reconciliation Order Amendment

The guarded production reconcile is split into two safe operations:

1. The operational SQL reconciles only the authoritative calendar: 15/10 becomes no-TP, Thursday class/occurrence indexes shift, DS rows remain no-TP, the 15/10 future assignments are removed, and linked unstarted legacy `session_plans.class_id` values are remapped to the corrected class/group. It does not invent or overwrite teacher/manipulation/room choices.
2. After the calendar matches TEST, the existing Admin-only `v16_apply_test_teacher_plan(date)` applies the validated TEST teacher/manipulation/room values atomically and revalidates weekly rules.

Reason: applying TEST structural rows before correcting the REAL class identity would attach the approved manipulation to the wrong class on post-holiday Thursdays. The TEST→REAL RPC therefore blocks with `REAL_CALENDAR_RECONCILIATION_REQUIRED` until step 1 is complete.

This amendment preserves the approved business rules and strengthens production safety.
