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

## 24/11/2026 — V42 : avis officiels du S2
- 6 avis S1 sans date de fin : fin d’affichage fixée au 11/12/2026. 4 avis S2 (horaire, démarrage MPI1, démarrage PC1, dates sans TP) visibles du 12/12/2026 au 30/04/2027. Sauvegarde : backup_20261122_enseignants_s1.v21_notices_v42.

## 25/11/2026 — V43 : espaces S2
- Tables spaces et space_members ; MPI1 · PC1 = premier espace (11 membres : 1 admin, 10 enseignants). Colonne space_id sur les 10 tables S2 et sur classes ; clés et règles d’accès par espace ; fonctions du planning S2 avec p_space (MPI1 · PC1 par défaut). Planning MPI1 · PC1 inchangé (30 séances, recalcul identique). Sauvegarde : backup_20261122_enseignants_s1.*_v43.

## 2026-11-25 — V44 à V44d : appel S2 depuis le planning (tous les espaces)
- V44 : `v33_s2_slots.attendance_session_id` + fonction `v44_s2_start_slot` (l'enseignant de la case ou l'administrateur de l'espace ouvre la séance du groupe).
- V44b : classes des autres espaces exemptées du catalogue MPI/PC/LPC3 (module libre, groupes 1–12) ; MPI1 · PC1 inchangé.
- V44c (sécurité) : `can_read_space` / `can_admin_space` renvoient toujours vrai/faux (un résultat NULL laissait passer une personne hors de l'espace). Vérifié : aucun usage indu (seul espace créé : LPHE1, par le super administrateur).
- V44d : à l'ouverture d'une séance S2 de MPI1 · PC1, un étudiant qui change de groupe est daté dans `v16_student_group_memberships` à la date de la séance (aucune ligne supprimée). Test annulé sur le vrai planning : 30 cases ouvertes, séances et présences du S1 inchangées, 0 chevauchement.
- Aucune donnée réelle modifiée par ces migrations (fonctions et colonne seulement).

## 2026-11-25 — V45 : planning des autres espaces visible au choix
- Tout enseignant peut consulter, en lecture, le planning S2 des autres espaces (séances, cases, créneaux, manipulations, réglages, postes, dates exclues). Les étudiants, groupes, versions et journal restent réservés aux membres.
- `v45_am_super_admin()` : distingue le super administrateur des administrateurs de l'application.
- Vérifié (test annulé) : un enseignant hors de LPHE1 voit son planning mais ni ses classes, ni ses étudiants, ni ses groupes, et ne peut rien modifier. Aucune donnée modifiée.

## 2026-11-25 — Besma Bellafi : administratrice de LPHE1 seulement (demande du super administrateur)
- `profiles.role` de Besma Bellafi : `admin` → `teacher`. Sauvegarde : `backup_20261122_enseignants_s1.profiles_besma_v47`.
- Elle reste administratrice de l'espace LPHE1. MPI1 · PC1 est géré par Dr. Souhail Souai seul (planning visible en lecture).
- Vérifié : recalcul et modification de MPI1 · PC1 refusés ; administration de LPHE1 conservée.

## 2026-11-25 — V46 : S1 masqué après le 12/12/2026 (aucune donnée supprimée)
- Site et application ne chargent plus les séances et le planning datés d'avant le 12/12/2026 ; « Archives S1 » (Administration) les réaffiche pour un administrateur. Toutes les données du S1 restent en base.

## 2026-11-25 — V47 : rôles et accès (permissions par personne et par espace)
- Table `space_permissions` ; `private.can_do` / `can_do_any` ; règles d'écriture S2, classes, étudiants, avis, appel et équipe vérifiées par permission. Un administrateur d'espace garde tout dans son espace.
- `v47_set_permissions` (super administrateur seul) : historique dans `v33_s2_audit` (action `set_permissions`, avant/après) pour annuler.

## 2026-11-26 — Comptes délégués, avis, annuaire
- Fonction serveur `admin-teacher` (v14, source dans `supabase/functions/admin-teacher`) : un administrateur d'espace ou un titulaire de « accounts.manage » crée un compte enseignant (ajouté à son espace) et réinitialise le PIN d'un enseignant de son espace ; jamais d'un administrateur ni du super administrateur. Comportement inchangé pour les administrateurs de l'application.
- V47d : lecture des avis pour « notices.edit » ; V47e : annuaire des enseignants pour « team.edit » / « accounts.manage ».

## 2026-11-26 — V51 : ouverture plus rapide (aucune donnée modifiée)
- Les politiques de lecture `attendance_select_authorized` et `sessions_select_authorized` utilisent `private.accessible_session_ids()` : la liste des séances visibles est calculée une fois par requête au lieu d'une vérification des droits par ligne. Règle d'accès identique.
- Vérifié avant et après sur 4 comptes (super administrateur, deux enseignants, responsable d'espace) : mêmes séances et mêmes présences ; lecture des présences d'un enseignant ~0,7 s → ~0,07 s.
- Retour arrière : recréer les deux politiques avec `private.can_access_session(session_id)` / `private.can_access_session(id)`.

## 2026-11-26 — V52 : groupes par classe (4, 5 ou 6) — aucune donnée modifiée
- Nouvelle colonne `v33_s2_class_slots.group_count` (4 à 6, vide = réglage de l'espace). Une classe a autant de manipulations que de groupes (rotation complète M1…Mn).
- `v37_s2_compute_plan` utilise le réglage de chaque classe ; l'heure d'une classe est lue dans son espace. Vérifié : sans réglage, le planning calculé est identique à avant (même empreinte pour les 3 espaces) ; essai annulé avec MPI1-A à 6 et MPI1-B à 4 : 6 et 4 séances, chaque groupe fait chaque manipulation une fois.

## 2026-11-27 — V53 : l'horaire d'une classe s'applique partout (aucune donnée modifiée par la migration)
- Déclencheur `v53_class_time_sync` sur `v33_s2_class_slots` : quand le début ou la fin d'une classe change, ses séances S2 à venir (à partir d'aujourd'hui, heure de Tunis) et les séances d'appel déjà ouvertes pour ces dates prennent le nouvel horaire, seulement si elles avaient l'ancien. Les séances passées ne bougent jamais. Chaque changement est noté dans `v33_s2_audit` (« class_time »).
- `enforce_v5_session_identity` laisse passer ce seul changement d'horaire pour un responsable d'espace non administrateur.
- Essai annulé : PC1-A 14:00–17:00 → 13:30–16:30 : ses 5 séances à venir passent à 13:30–16:30, MPI1-A inchangée.
