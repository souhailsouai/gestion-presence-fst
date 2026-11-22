# Sauvegarde et protection S1 — 22/11/2026

## Sauvegarde
- Schéma `backup_20261122` : copie de chacune des 46 tables de `public` (accès révoqué pour anon/authenticated).
- Contrôle : nombre de lignes identique pour les 46 tables ; contenu identique (hash md5 ligne à ligne) pour `students`, `attendance`, `sessions`.
- Restauration d'une table : `truncate public.X; insert into public.X select * from backup_20261122.X;` (colonnes ajoutées après la sauvegarde : lister les colonnes explicitement).

## Empreinte des séances protégées (23/11 → 11/12/2026 inclus), avant tout travail
| Élément | Lignes | md5 |
|---|---|---|
| sessions | 6 | 9d95bbbd97d892a0436d9143f13020d9 |
| attendance de ces séances | 0 | d41d8cd98f00b204e9800998ecf8427e |
| v21_official_sessions de la période | 9 | 3241394a9e6e3b871a34e95b36c77d2c |

À recalculer en fin de chantier avec la même requête pour prouver qu'elles sont inchangées.

## Migrations V32 appliquées
- `v32_attendance_makeup` : `attendance.makeup_date`, `attendance.makeup_note` (additif, nullable).
