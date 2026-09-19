# Gestion Présence FST — V3.0

Release finale basée sur la dernière V23 validée le 19/09/2026.

## Référence fonctionnelle
- Année universitaire : 2026/2027
- Source officielle des affectations : `public.v21_teacher_day_manipulations`
- Configuration complète exigée : 18 affectations
  - Lundi : M1 à M6
  - Jeudi : M1 à M6
  - Vendredi : M1 à M6
- Enregistrement via `public.v23_save_teacher_configuration(jsonb)`
- Vérification après écriture : les 18 lignes relues doivent correspondre exactement aux 18 sélections.
- En cas d'écart, aucun succès n'est annoncé.
- Après succès, seuls les `session_plans` non ouverts sont régénérés.
- Les séances ouvertes, présences, notes et historiques restent inchangés.
- Les vues Planning et Enseignants utilisent la même source officielle.
- L'accès à la RPC V23 est réservé au rôle `authenticated`; `anon` ne peut pas l'exécuter.

## Nom de diffusion
Le front-end final doit être distribué sous le nom :

`Gestion-Presence-FST-Web-V3.0.html`

## Backend
Migration de référence incluse dans ce dossier :
`20260919102000_v23_teacher_assignment_sync.sql`
