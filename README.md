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

## Cadre responsive partage

Le cadre commun entoure les onglets existants sans remplacer leurs fonctions metier.
`shared/fst-navigation.json` est le registre unique des cibles, libelles et permissions.
`shared/fst-shell.js` gere la sidebar, le tiroir et le menu utilisateur ;
`shared/fst-shell.css` definit leur geometrie. `scripts/fst_shell_transform.py`
applique ce cadre aux chemins Pages et Web autonome.

La sidebar mesure 256 px (72 px repliee). Elle est repliee par defaut entre
768 et 1199 px et devient un tiroir sous 768 px. Les deux logos gardent leurs
identifiants et des dimensions reservees. Les anciens fichiers mobiles restent
dans Git pour la tracabilite mais leurs controles visuels ne sont pas dupliques
dans les nouveaux artefacts. `shared/fst-auth-compat.js` conserve les points
d'entree historiques de connexion et de changement de compte.

Une seule activation passe par le routeur existant. L'autorisation LPC3 est
reutilisee, et une reponse LPC3 devenue obsolete apres un changement de compte
est ignoree. Les enregistrements de presence et de note ne sont pas modifies
par les actions du cadre. Le suivi des seances distingue les pointages absents
(« Non renseignes ») des statuts reellement enregistres ; une note seule n'est
pas une preuve de presence.

## Web et GitHub Pages

Le déploiement GitHub Pages est généré par `.github/workflows/deploy-pages.yml`. Le build part du socle fonctionnel verrouillé et ajoute les modules actuels ainsi que la couche responsive mobile.

Build Web :

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```

Pour construire le candidat Pages, utiliser `python scripts/build_pages_from_41881.py`.
Ce script et le build Web ecrivent tous deux `web/index.html` : ne pas lancer
ces builds en parallele dans le meme repertoire.

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

Verification locale, dans une copie de travail isolee :

```bash
node --test --test-concurrency=1 tests/web/*.test.cjs
python -m pip install -r tests/browser/requirements.txt
python -m playwright install --with-deps chromium
python scripts/build_pages_from_41881.py
python -m unittest discover -s tests/browser -p 'test_fst_shell.py' -v
python tests/browser/capture_fst_shell.py --artifact web/index.html --out artifacts/ui/pages
python scripts/build_online_web.py
python scripts/build_single_file_release.py
python -m unittest discover -s tests/browser -p 'test_fst_shell.py' -v
```

Le banc navigateur execute les vrais controleurs dans Chromium avec un fournisseur
reseau et des profils de test explicites ; il n'ecrit pas dans Supabase. Il couvre
neuf viewports, les bornes de breakpoint, les roles, la connexion avec fournisseur
simule, le focus et la conservation de saisies. Il ne remplace pas la recette
avec de vraies sessions autorisees ni le test graphique Windows/WebView2.

La validation PR est definie par `ui-shell-validation.yml`, `v31-validation.yml`,
`build-web.yml` et `build-windows-online.yml`. Le workflow Pages effectue aussi
les tests navigateur avant publication. Les preuves et limites du lot sont
consignees dans `docs/verification/fst-shared-shell-report.md`.

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

Le lot d'interface n'applique aucune migration SQL. En cas de regression apres
integration, revenir par un commit de revert puis reconstruire et redeployer
l'artefact valide ; ne pas reinitialiser la base ni forcer l'historique Git.
Le nettoyage des branches, fichiers et objets Supabase est un lot distinct,
conditionne a la recette et a la preuve d'absence de dependances.
