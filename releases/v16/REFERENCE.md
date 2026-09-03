# App présence — V16 candidate reference

This directory records the verified V16 candidate built from the immutable V5.13 baseline.

- Version: V16
- Status: frontend candidate — not merged; V16 backend migrations deployed to the existing `Gestion-Presence` Supabase project
- Stable base: V5.13
- Base V5.13 canonical SHA-256: `73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8`
- Candidate artifact filename: `Gestion-Presence-FST-Web-2026-2027.html`
- Candidate artifact SHA-256: `761348c31e62609d9179d036b79cf1ef93db39419ffe530135566c654f15fea7`
- GitHub Actions artifact: `Gestion-Presence-FST-Web-V16-candidate`
- Verified workflow run: `33800030133`
- Planning source: `Emploi_du_temps_TP_MPI1_PC1_2026_2027_Avec_Enseignants.pdf`
- Academic year: 2026/2027
- Semester: 1

## V16 scope

V16 preserves the V5.13 institutional visual language while adding a native `Planning des séances` workflow. The delivered navigation is:

`Dashboard | Présence | Classes & Groupes | Emploi du temps | Étudiants | Séances | Planning des séances | Rapports | Administration`

V16 includes:

- official 2026/2027 TP calendar, rotations and fixed rooms;
- interactive planning filters and exact filtered PDF/XLSX exports;
- Admin-only teacher arrangement with 4 teachers per teaching day and 2 teaching days per week per teacher;
- weekly and future teacher permutations protected against started sessions;
- effective-dated G1–G4 student membership history without rewriting historical attendance;
- dated session roster resolution;
- explicit active teacher/Admin role separation;
- isolated permanent Admin TEST context with TEST-only reset;
- validated TEST → RÉEL application for future teacher assignments only;
- actual-session `Emploi du temps` with direct navigation to the existing `Présence` loader;
- preservation of V5.13 attendance, grade and completed-session permissions.

## Build verification

Workflow run `33800030133` completed JavaScript syntax checks, all Web contract/regression tests, online build, standalone build, final artifact verification and artifact upload successfully on the frontend candidate branch.

## Backend deployment

On 2026-09-03 the six V16 backend migrations were applied directly to the existing Supabase project `Gestion-Presence` (`dbslzmvzbxczpqyektpx`) after explicit approval:

- `v16_teacher_weekly_policy`
- `v16_teacher_permutations`
- `v16_student_group_history`
- `v16_session_rosters`
- `v16_test_context`
- `v16_apply_test_to_real`

Post-deployment verification confirmed that all V16 RPCs exist as `SECURITY INVOKER`, `anon` has no EXECUTE privilege on them, and the V16 TEST tables have Admin-only RLS policies. No V16 planning cycle, session, assignment, student membership, TEST session, TEST attendance or TEST scenario was created by the deployment itself.

The Supabase security advisor still reports warnings on older V5/V5.13 `SECURITY DEFINER` functions. These warnings predate the V16 backend objects and are not introduced by the V16 migrations.

## Deployment rule

The V16 backend schema is deployed, but the frontend candidate remains on `feature/v16-planning` and PR #9 remains unmerged. Frontend merge/release still requires explicit approval after functional testing with an authenticated Admin and teacher account.

V5.13 remains the immutable stable baseline and must not be overwritten.
