# App présence — V16 candidate reference

This directory records the verified V16 candidate built from the immutable V5.13 baseline.

- Version: V16
- Status: candidate — not merged and not deployed to production
- Stable base: V5.13
- Base V5.13 canonical SHA-256: `73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8`
- Candidate artifact filename: `Gestion-Presence-FST-Web-2026-2027.html`
- Candidate artifact SHA-256: `761348c31e62609d9179d036b79cf1ef93db39419ffe530135566c654f15fea7`
- GitHub Actions artifact: `Gestion-Presence-FST-Web-V16-candidate`
- Verified workflow run: `33798083675`
- Verified artifact ID: `9909964463`
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

Workflow run `33798083675` completed JavaScript syntax checks, all Web contract/regression tests, online build, standalone build, final artifact verification, SHA-256 verification and artifact upload successfully.

The standalone artifact checksum above was read from the workflow-generated `SHA256SUMS.txt` contained in artifact ID `9909964463`.

## Deployment rule

The V16 migrations in `supabase/migrations/20260903170000_*` through `20260903170500_*` are candidate migrations only. They have not been deployed from this V16 branch. Production deployment and PR merge require explicit approval.

V5.13 remains the immutable stable baseline and must not be overwritten.
