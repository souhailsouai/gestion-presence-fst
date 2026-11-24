# Journal des corrections de données (production)

Les changements de **structure** de la base sont dans `supabase/migrations/`.
Ce journal trace les corrections de **données** faites directement en production,
pour que chaque état de la base puisse être expliqué. Aucune donnée personnelle ici :
seulement la nature, le volume et l'emplacement de la sauvegarde.

Règle : avant toute correction de données, sauvegarde dans un schéma `backup_AAAAMMJJ_*`,
puis une ligne dans ce journal.

| Date | Correction | Volume | Sauvegarde |
|---|---|---|---|
| 22/11/2026 | Enseignants S1 recalés sur le tableau officiel jour × manipulation | 124 affectations, 18 lignes du tableau des enseignants | `backup_20261122_enseignants_s1` |
| 22/11/2026 | Anciennes règles d'affectation (semestre) supprimées | 14 lignes | `backup_20261122_enseignants_s1` |
| 22/11/2026 | Tables et fonctions V5/V5.13 inutilisées supprimées | 5 tables, 13 fonctions | `backup_20261122_enseignants_s1` (contenu des tables) |
| 22/11/2026 | Salles S1 fixes par manipulation (migration V38) | 100 affectations | `backup_20261122_enseignants_s1.v515_assignments_rooms_v38` |
| 22/11/2026 | Séances réelles reliées à leur ligne du planning S1 | 63 lignes | `backup_20261122_enseignants_s1.session_plans_v39` |
| 22/11/2026 | Rattrapage MPI1-D le 10/12 (6 groupes avec MPI1-C) | 6 lignes de planning | — (ajout) |
| 22/11/2026 | LPC3 : séances après le 26/11 retirées (aucun appel saisi) | 4 séances | `backup_20261122_enseignants_s1.lpc3_sessions_v40` |
| 22/11/2026 | Appels vérifiés avec les cahiers : 1 présence ajoutée, 1 absence sur case vide retirée, 2 étudiants réintégrés avec leurs appels | 11 lignes | `backup_20261122_enseignants_s1.attendance_v41` |
| 22/11/2026 | Examen LPC3 : 4 séances le 10/12 (10h00–11h30), appel commun dans l'application | 4 séances | — (ajout) |
| 23/11/2026 | S2 : 5 groupes équilibrés, 5 manipulations (M6 désactivée), planning brouillon recalculé | 228 membres, 30 séances | `backup_20261122_enseignants_s1.s2_members_v42`, `s2_settings_v42`, version S2 automatique |
| 23/11/2026 | Sécurité : double authentification obligatoire pour l'administrateur (migration V39) | 1 profil | — |
| 23/11/2026 | Planning du site (V21) : date du rattrapage MPI1-D fixée au 10/12 ; V21 identique au planning réel | 1 séance | — |

## Tables protégées sans règle d'accès (voulu)

`admin_pin_attempts`, `admin_pin_credentials`, `legacy_entity_map`, `super_admin_owner` :
accès refusé à tous les utilisateurs de l'API ; seules les fonctions serveur y accèdent.

## 24/11/2026 — V41 : double authentification facultative
- À la demande de l’administrateur : plus de code à chaque connexion. 1 profil administrateur (mfa_required → false), politique « optional », droits admin sans exigence AAL2. Aucune donnée étudiante modifiée.
