# Gestion de Présence FST

Application institutionnelle de gestion des travaux pratiques de la Faculté des Sciences de Tunis (Université de Tunis El Manar).

## Fonctionnalités

- authentification enseignants et administrateurs ;
- gestion des étudiants, classes et groupes ;
- planning et séances de TP ;
- saisie des présences, retards, absences et justifications ;
- notes, historique pédagogique et statistiques ;
- exports Excel de suivi ;
- espace LPC3 « TP Ondes et Vibrations » réservé à son enseignant autorisé ;
- interface responsive pour ordinateur, tablette et smartphone.

## Architecture

Le dépôt conserve les sources Web, les scripts de génération, les migrations Supabase, les tests et les clients synchronisés. La branche de production est `main`.

Les fichiers historiques et les migrations peuvent conserver des identifiants techniques de version pour la traçabilité. Aucun numéro de version applicative ne doit être présenté comme élément d'interface.

## Web et GitHub Pages

Le déploiement GitHub Pages est généré par `.github/workflows/deploy-pages.yml`. Le build part du socle fonctionnel verrouillé et ajoute les modules actuels ainsi que la couche responsive mobile.

Build Web :

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```

## Windows

Le client Windows synchronisé embarque le même comportement Web validé. Le workflow de production correspondant se trouve dans `.github/workflows/`.

## Supabase

Supabase fournit l'authentification, PostgreSQL, RLS, RPC, Realtime et les Edge Functions. Les migrations sont conservées sous `supabase/migrations/`.

Principes de sécurité :

- aucune clé `service_role` dans les clients ;
- RLS active sur les données exposées ;
- mutations sensibles contrôlées côté serveur ;
- séparation stricte de LPC3 au niveau interface et base de données.

## LPC3

L'espace LPC3 regroupe les TP d'Ondes et Vibrations. Son accès est réservé au compte propriétaire configuré côté Supabase. La même règle d'autorisation est réutilisée par les navigations desktop et mobile ; la sécurité réelle reste appliquée côté RLS/RPC.

## Excel

Les exports de suivi sont produits avec SheetJS et testés par génération puis réouverture réelle des classeurs. Les exports MPI1-PC1 et LPC3 restent séparés.

## Tests

La suite Web se trouve sous `tests/web/`. Les workflows GitHub Actions exécutent les contrôles de syntaxe, les tests de régression, les builds et les vérifications des artefacts avant déploiement.

## Structure principale

- `web/` : modules Web ;
- `shared/` : couche responsive partagée ;
- `scripts/` : génération des artefacts ;
- `tests/` : tests de régression et d'intégration ;
- `supabase/` : migrations et fonctions backend ;
- `windows/` : client Windows ;
- `.github/workflows/` : CI/CD.

## Déploiement

Toute modification de production doit être intégrée dans `main` uniquement après réussite des tests et builds. GitHub Pages est ensuite déployé par GitHub Actions.
