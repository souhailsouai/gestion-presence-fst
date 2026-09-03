# V16 — Design du planning TP 2026/2027, groupes étudiants et mode TEST

Date : 2026-09-03
Statut : design validé en conversation
Base fonctionnelle : V5.13, à préserver sans régression
Branche de travail : `feature/v16-planning`

## 1. Positionnement de V16

V16 est la nouvelle version cible. La V5.13 reste la référence fonctionnelle et visuelle pour les écrans existants, notamment Présence, Étudiants, Séances, Emploi du temps, Rapports et Administration. V16 ajoute un vrai module intégré de planification, des affectations enseignants administrables, une historisation des groupes étudiants, un mode TEST Admin permanent et la génération de documents.

L’ancienne logique V5.15 sous forme de fenêtre séparée ne doit pas rester l’interface finale. V16 doit être intégrée nativement à la navigation V5.13.

## 2. Navigation V16

Ordre validé des rubriques :

`Dashboard | Présence | Classes & Groupes | Emploi du temps | Étudiants | Séances | Planning des séances | Rapports | Administration`

Règles :

- Présence est immédiatement après Dashboard.
- Planning des séances est une rubrique de premier niveau, pas un bouton flottant ni une fenêtre modale séparée.
- Le style, les cartes, boutons, tableaux, badges, formulaires, espacements et comportements visuels doivent rester cohérents avec V5.13.

## 3. Source de vérité du planning

La rotation officielle 2026/2027 provient des documents PDF/Excel fournis par l’utilisateur. L’application ne doit pas recalculer librement une autre rotation.

Jours concernés :

- lundi : MPI1-A / MPI1-E, 13:45–17:30 ;
- jeudi : MPI1-C / MPI1-D, 13:30–17:30 ;
- vendredi : MPI1-B / PC1-A, 13:30–17:30.

Salles fixes :

- M1 → Salle C
- M2 → Salle B
- M3 → Salle D
- M4 → Salle D
- M5 → Salle A
- M6 → Salle A

Les jours REPOS, fériés ou sans TP apparaissent dans le planning mais ne créent pas de séance de présence.

Les dates, classes, groupes, manipulations et salles issus de la référence officielle sont protégés contre les modifications libres.

## 4. Rubrique Planning des séances

Cette rubrique est le centre de préparation, contrôle et exploitation du planning.

### 4.1 Filtres interactifs

Filtres combinables :

- année ;
- semestre ;
- classe ;
- groupe ;
- jour ;
- semaine ;
- enseignant ;
- manipulation ;
- salle ;
- période.

Le tableau se met à jour selon les filtres et affiche au minimum :

`Semaine | Date | Jour | Horaire | Classe | Groupe | Manipulation | Salle | Enseignant | État`

Vues prévues :

- planning complet ;
- par semaine ;
- par classe ;
- par groupe ;
- par enseignant ;
- par jour.

### 4.2 Cycle de vie

L’Admin peut initialiser, vérifier, publier, finaliser et adapter les affectations futures selon les règles décrites plus bas.

Avant publication/finalisation, toutes les séances enseignantes doivent être couvertes par un enseignant. Les lignes REPOS/férié/sans TP sont exclues de cette exigence.

### 4.3 Génération de fichiers

L’Admin peut générer la vue filtrée en :

- PDF ;
- Excel `.xlsx`.

Exemples :

- planning complet MPI1-A ;
- planning MPI1-A/G2 ;
- planning du lundi ;
- planning d’une semaine ;
- planning d’un enseignant ;
- toutes les séances M3 ;
- planning d’une salle ;
- planning général du semestre.

Les fichiers générés portent automatiquement un en-tête institutionnel FST, l’année 2026/2027, le semestre, le titre du filtre utilisé et la date de génération.

## 5. Affectations enseignants

### 5.1 Principe général

Les enseignants sont affectés par l’Admin. Les enseignants ne s’auto-affectent pas, ne demandent pas de séance et ne valident pas leur propre affectation.

Avant le début d’une séance, l’Admin peut modifier ou remplacer l’enseignant. Une séance commencée ou terminée est verrouillée pour l’historique.

### 5.2 Répartition hebdomadaire

La contrainte validée est :

- 4 enseignants le lundi ;
- 4 enseignants le jeudi ;
- 4 enseignants le vendredi ;
- chaque enseignant intervient exactement 2 jours par semaine ;
- aucun enseignant n’apparaît deux fois le même jour ;
- aucun conflit horaire ;
- toutes les séances à couvrir disposent d’un enseignant.

Le système vérifie ces règles avant publication/finalisation et lors de l’application d’une nouvelle configuration.

### 5.3 Permutations

Avant la configuration finale, l’Admin peut effectuer une permutation entre enseignants d’un jour à un autre.

Deux modalités sont supportées :

- permutation limitée à une semaine ;
- permutation permanente pour toutes les semaines futures.

Un bouton `Permuter` peut échanger deux enseignants tout en conservant automatiquement la contrainte 4 enseignants/jour et 2 jours/semaine/enseignant.

Après finalisation, l’historique passé reste figé. Une nouvelle organisation peut néanmoins être préparée en mode TEST puis appliquée uniquement aux séances futures non commencées.

## 6. Étudiants et groupes

### 6.1 Ajout des étudiants

Les étudiants peuvent être ajoutés ultérieurement. Leur absence initiale ne bloque pas l’initialisation du planning.

Chaque étudiant est affecté manuellement par l’Admin à :

- une classe ;
- un groupe G1, G2, G3 ou G4 ;
- une date d’effet.

### 6.2 Historisation des groupes

Chaque changement de groupe conserve :

- ancien groupe ;
- nouveau groupe ;
- date d’effet ;
- date de fin éventuelle ;
- Admin ayant réalisé l’opération.

Un changement de groupe s’applique uniquement aux séances futures à partir de sa date d’effet. Les présences, notes, commentaires et groupes historiques des séances antérieures ne sont jamais réécrits.

Exemple : `G2 du 14/09/2026 au 11/10/2026 → G3 à partir du 12/10/2026`.

### 6.3 Nouveaux étudiants, sortie et réactivation

Un nouvel étudiant ajouté en cours d’année apparaît dans les séances à partir de sa date d’affectation, jamais rétroactivement.

Un étudiant qui quitte la classe ou devient inactif possède une date d’effet. À partir de cette date, il ne figure plus dans les séances futures, mais son historique reste intact.

Une réactivation ultérieure est possible avec une nouvelle date d’effet.

## 7. Lien Planning → Emploi du temps → Séances → Présence

Le planning est la source de préparation. Une fois publié :

- Emploi du temps affiche automatiquement les séances correspondant aux affectations ;
- Séances reçoit les séances planifiées ;
- Présence exploite ces séances selon le comportement V5.13 ;
- les étudiants affichés sont ceux dont l’affectation au groupe est valide à la date de la séance.

Une modification d’enseignant sur une séance future est immédiatement reflétée dans Emploi du temps et Séances.

Un clic sur une séance dans Emploi du temps ouvre directement Présence avec cette séance sélectionnée.

## 8. Non-régression Présence / Notes

V16 ne change pas les règles métier validées de V5.13 :

- avant clôture : saisie de présence par l’enseignant affecté et l’Admin ;
- après clôture : présence modifiable uniquement par l’Admin ;
- notes modifiables avant et après clôture selon les droits existants ;
- un enseignant étranger à la séance ne peut pas modifier la présence ;
- les données historiques d’une séance passée ne sont pas réassignées rétroactivement.

## 9. Mode TEST Admin permanent

### 9.1 Visibilité

Le mode TEST est réservé exclusivement à l’Admin. Il n’apparaît jamais pour les enseignants.

Même pour Souhail Souai, lorsque le rôle actif est Enseignant, le mode TEST, les fonctions Admin et les commandes d’affectation ne sont pas affichés.

### 9.2 Sélecteur de contexte

En rôle Administrateur, un sélecteur très visible permet :

`MODE RÉEL ⇄ MODE TEST`

Le contexte actif doit être impossible à confondre visuellement.

### 9.3 Données TEST

Le mode TEST est un environnement logique séparé du RÉEL. Il permet à l’Admin de :

- ouvrir toutes les séances en avance ;
- vérifier l’affichage des groupes et étudiants ;
- tester présences, notes, clôtures et workflows ;
- préparer une nouvelle répartition d’enseignants ;
- simuler cette organisation sur plusieurs semaines ;
- réinitialiser les données TEST à tout moment.

Les données TEST ne figurent jamais dans les rapports réels.

### 9.4 Réinitialisation TEST

Le bouton `Réinitialiser les tests` efface uniquement les données propres au TEST : états de test, présences test, notes test, commentaires test et modifications de scénario non appliquées.

Il ne supprime ni le planning officiel, ni les classes, ni les groupes, ni les étudiants réels, ni l’historique réel.

### 9.5 Appliquer TEST au RÉEL

L’Admin peut préparer une nouvelle organisation des enseignants en TEST, la vérifier, puis utiliser :

`Appliquer cette organisation au mode RÉEL`

Seule la structure explicitement autorisée des affectations enseignants est transférée. Les présences, notes, commentaires et données de test ne sont jamais copiés vers le RÉEL.

Avant application, l’Admin voit un résumé :

`Configuration actuelle → Configuration proposée → Date d’effet → Semaines concernées → Anomalies`

L’application au RÉEL concerne uniquement les séances futures non commencées. Aucune séance commencée ou terminée n’est modifiée rétroactivement.

Le mode TEST reste disponible même après le démarrage officiel et après finalisation du planning.

## 10. Rôles actifs

Pour un compte disposant des droits Admin et Enseignant, l’interface expose un rôle actif explicite :

- `Rôle : Administrateur`
- `Rôle : Enseignant`

Le changement de rôle ne change pas de compte, mais modifie immédiatement l’interface et les permissions.

En rôle Enseignant :

- aucun mode TEST ;
- aucune permutation ;
- aucune initialisation/finalisation ;
- aucune gestion globale des groupes ;
- accès normal aux fonctions enseignant.

En rôle Administrateur : les fonctions de gestion, TEST et planification sont disponibles selon les permissions serveur.

Les droits dépendent du rôle actif, jamais du nom de l’utilisateur.

## 11. Vérification automatique du planning

Le bouton `Vérifier le planning` contrôle au minimum :

- séances manquantes ;
- rotation G1–G4 / M1–M6 incorrecte ;
- salle incorrecte ;
- enseignant non autorisé pour le scénario courant ;
- conflit horaire ;
- doublon enseignant le même jour ;
- non-respect des 4 enseignants/jour ;
- non-respect des 2 jours/semaine/enseignant ;
- groupe invalide ;
- affectation incomplète.

Les anomalies bloquantes empêchent publication, finalisation ou application TEST → RÉEL. Les avertissements non bloquants restent visibles.

## 12. Sécurité et audit

Les règles critiques sont imposées côté Supabase/RPC, pas seulement dans l’interface.

Le journal d’audit doit enregistrer les opérations sensibles, notamment :

- initialisation ;
- publication ;
- finalisation ;
- affectation ou remplacement enseignant ;
- permutation ;
- changement de groupe étudiant ;
- activation/inactivation étudiant ;
- réinitialisation TEST ;
- application d’une configuration TEST au RÉEL.

Pour une application TEST → RÉEL, l’audit conserve au minimum : Admin, date/heure, configuration précédente, configuration appliquée et date d’effet.

## 13. Tests d’acceptation

Les tests doivent couvrir :

- ordre exact de navigation V16 ;
- absence totale du mode TEST en rôle Enseignant ;
- comportement identique de Souhail Souai et des autres enseignants quand le rôle actif est Enseignant ;
- rotation exacte des trois plannings officiels ;
- salles fixes M1–M6 ;
- jours REPOS/fériés sans séance de présence ;
- 4 enseignants par jour ;
- exactement 2 jours hebdomadaires par enseignant ;
- permutations semaine et permanentes ;
- verrouillage des séances commencées ;
- changement de groupe étudiant par date d’effet ;
- absence de réécriture rétroactive ;
- ajout, sortie, inactivation et réactivation d’étudiants ;
- Emploi du temps → Présence ;
- génération PDF/Excel selon filtres ;
- séparation stricte TEST/RÉEL ;
- réinitialisation TEST ;
- application TEST → RÉEL limitée aux séances futures ;
- non-régression complète des règles Présence/Notes V5.13.

## 14. Principe de livraison

V16 doit être développée à partir de la base V5.13 et du travail préparatoire existant, sans modifier la branche stable `release/v5.13`.

Le résultat final attendu est une application homogène, où Planning des séances est une rubrique native, où la rotation officielle reste protégée, où les enseignants sont administrables avec contrôle hebdomadaire, où les groupes étudiants sont historisés et où le mode TEST Admin permet de valider des scénarios avant application au RÉEL.
