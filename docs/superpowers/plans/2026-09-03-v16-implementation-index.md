# V16 Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap plan-by-plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver V16 as an interactive evolution of V5.13 with native planning, effective-dated student groups, controlled teacher permutations, permanent Admin TEST mode, and filtered PDF/Excel exports.

**Architecture:** Preserve `release/v5.13` as the stable baseline. Implement V16 on `feature/v16-planning` through five independent, testable plans that build on the approved design without rewriting the V5.13 attendance/grade core.

**Tech Stack:** HTML/CSS/vanilla JavaScript, Node.js `node:test`, Supabase PostgreSQL/RPC/RLS, Python build scripts, existing PDF engine.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- Version name is **V16**.
- Base functional and visual reference is **V5.13**.
- `release/v5.13` must remain unchanged.
- Navigation order is `Dashboard | Présence | Classes & Groupes | Emploi du temps | Étudiants | Séances | Planning des séances | Rapports | Administration`.
- Planning rotation, dates and rooms come from the official 2026/2027 planning source.
- Admin owns planning/teacher changes; teacher mode never exposes TEST/Admin controls.
- TEST and RÉEL data must be strictly isolated.
- No operation may rewrite attendance/grades for a started or completed real session.
- Interactive controls update without full-page reload and expose explicit loading/success/error states.

---

## Execution order

- [ ] **Plan 1 — Native interactive shell and Planning des séances**
  `docs/superpowers/plans/2026-09-03-v16-native-interactive-planning.md`
- [ ] **Plan 2 — Teacher weekly rules and permutations**
  `docs/superpowers/plans/2026-09-03-v16-teacher-permutations.md`
- [ ] **Plan 3 — Student group history and dated rosters**
  `docs/superpowers/plans/2026-09-03-v16-student-group-history.md`
- [ ] **Plan 4 — Permanent Admin TEST/RÉEL mode**
  `docs/superpowers/plans/2026-09-03-v16-test-real-mode.md`
- [ ] **Plan 5 — Exports, timetable-to-presence integration, and release regression**
  `docs/superpowers/plans/2026-09-03-v16-exports-integration-release.md`

## Acceptance gate between plans

Each plan must end with focused tests green, existing V5.13 attendance/grade regression tests green, standalone Web build succeeding, and a review checkpoint before the next plan starts.

No production Supabase migration is applied merely because a migration file exists in the branch. Production deployment is a separate explicit step after verification and user approval.
