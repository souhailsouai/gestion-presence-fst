# Gestion de Presence FST - bilan du cadre partage

## Statut de livraison

Candidat sur `fix/shared-responsive-shell`, PR #24. Reference de production :
`711cd0c66ed1c681bddedd119efc205c6c1f3818`. Aucune fusion ni aucun deploiement
sur `main` ne sont declares par ce rapport. Aucun objet ou enregistrement
Supabase n'a ete modifie ou supprime pendant ce lot.

L'integration reprend les travaux existants, avec le commit publie
`828a82ddc35f6ec3d4216729348908eeb6fc973a` puis un correctif cible du suivi LPC3.
Le dernier SHA et les controles CI associes sont consignes dans la PR #24.

## Changements implementes

Le cadre utilise une seule navigation, une sidebar de 256 px (72 px repliee),
un tiroir sous 768 px et un header compact. Les deux vrais logos sont preserves,
avec leurs identifiants et des dimensions reservees. Les memes cibles et
permissions alimentent desktop et mobile ; les fonctions metier ne sont pas
reconstruites. Les identifiants techniques restent internes.

Les anciens cadres mobiles sont retires du HTML genere, pas detruits dans Git.
Leur code d'authentification effectif est conserve dans un adaptateur separe.
Le routeur historique garde ses effets metier ; sa selection de bouton actif
ne depend plus d'un evenement souris implicite lors d'une activation programmee.

LPC3 ne charge plus deux fois les memes donnees sur un clic mobile. Une lecture
en cours est mutualisee ; un resultat devenu obsolete apres changement de
compte est ignore. Le bouton de rechargement est reactive en cas d'erreur.
Un export LPC3 n'est pas lance a partir de donnees anciennes apres un echec.

Les tableaux larges ont un defilement local. Le focus est restitue a la fermeture
du tiroir et des commandes de compte, les touches Tab/Echap sont testees, et
les actions du cadre conservent les vrais champs de saisie non enregistres.

La relecture a detecte un defaut anterieur dans le suivi des seances LPC3 :
un pointage absent, ou une ligne ne contenant qu'une note, etait compte comme
Present. Reproduction sur l'archive de production et sur le candidat : une
seance/une personne/zero pointage donnait un present. Le correctif emploie la
fonction centrale `summarizeAttendance` et affiche ces cas en Non renseignes.
Il ne cree aucun pointage, ne transforme pas le statut en absence, et ne change
aucune note ni le contrat de sauvegarde. Un zero manuel de note seule est conserve.

## Verification locale finale

| Controle | Resultat |
|---|---|
| Suite JavaScript complete, execution serialisee | 274/274, zero echec |
| Tests Chromium sur le payload Pages | 25/25 |
| Tests Chromium sur le HTML autonome Web/Windows | 25/25 |
| Captures et mesures par artefact | 9 viewports, plus tests de bornes 767/1199 px |
| Exceptions JavaScript pendant les scenarios couverts | Aucune |
| Exports XLSX de test generes puis relus avec openpyxl | 8 fichiers |

Viewports : 1920x1080, 1440x900, 1366x768, 1200x800, 1024x768, 768x1024,
430x932, 390x844 et 360x800. Les rectangles sont mesures : titre, logos,
commandes du header, debordement global et modale PIN. Les tests ne se limitent
pas a rechercher des noms de classes dans les sources.

Les tests utilisent les vrais controleurs, formulaires et routeurs mais des
profils/reponses reseau de test explicites. Ils ne constituent pas une connexion
reelle a Supabase et ne valident pas la persistance en production. Toutes les
mutations du fournisseur de test sont interdites et comptees.

L'essai XLSX local emploie le moteur navigateur du depot avec un adaptateur de
sortie vers fichiers Node, uniquement pour le test ; le serialiseur reste
inchange. Les controles verifient noms, six feuilles dans le global MPI1-PC1,
LPC3 separe, notes numeriques, zero d'absence, vide justifie et pourcentages.
Ce n'est pas une ouverture graphique dans Microsoft Excel.

## Mesures avant/apres

Mesures locales, meme Chromium et memes donnees de test, sans inference sur la
latence du reseau de production :

| Mesure | Archive de production | Candidat |
|---|---:|---:|
| Hauteur du header a 1366 px | 291,75 px | 64 px |
| Hauteur du header a 390 px | 253,125 px | 119 px |
| Chargements logiques LPC3 par clic mobile | 2 | 1 |
| Lectures de tables pour ce chargement | 10 | 5 |

## Verification serveur en lecture seule

Deux transactions READ ONLY suivies de ROLLBACK ont teste les lectures avec
`SET LOCAL ROLE authenticated`, RLS active, `rolbypassrls = false` et des claims
JWT simules. Le proprietaire obtient 4 groupes, 33 etudiants et 19 seances LPC3 ;
l'autre enseignant obtient zero ligne de ces ensembles. Aucune ligne de presence
LPC3 n'existait dans le jeu de production observe : un resultat zero ne prouve
pas a lui seul le filtrage de lignes de notes/presences deja enregistrees.

Ce controle prouve ces lectures RLS sous ces identites simulees, pas un login
reel, toutes les RPC ni les politiques d'ecriture. Aucun secret ou mot de passe
n'a ete extrait, saisi ou modifie.

## CI et revue

Sur le commit 828a82d, les quatre workflows ont reussi :
- V31 validation : run 37211751431 ;
- Build Secure Web Application : run 37211751382 ;
- Build Synchronized Windows Application : run 37211751418 ;
- Shared shell validation : run 37211751406.

Ils attestent notamment la compilation/publication Windows .NET 8, pas son
execution graphique WebView2. Le correctif supplementaire du rapport LPC3
relance ces controles ; leurs derniers resultats doivent etre lus sur la PR.

Relecture de l'auteur, dans une passe separee, sans reviewer independant.
Constats importants : routeur dependant de window.event et faux comptage des
pointages manquants, tous deux reproduits par des tests en echec avant correction.
Les exceptions de rendu ne sont pas neutralisees pour faire reussir les tests.

## Decisions de l'integration et risques residuels

1. Restaurer le travail depuis l'archive source de la branche, verifiee par SHA-256,
   apres reinitialisation du conteneur, sans reconstruire le cadre. Le Git local
   est un snapshot, pas l'historique distant ; les objets publies utilisent le
   vrai parent et un fast-forward. Risque d'un mauvais arbre : ecarte par
   comparaison complete des empreintes Git avant publication.
2. Adapter les assertions de structure de l'ancienne barre horizontale au cadre
   approuve, sans enlever les assertions metier, d'identite des routes et des
   logos. Risque : masquer une regression ; contre-mesures : rendu reel et
   comparaison des contenus/attributs conserves.
3. Conserver les chemins d'authentification historiques distincts Pages/V2 ;
   leurs rejets et restauration sont testes sans imposer des appels identiques
   inexistants dans la reference. Risque residuel : provider reel non teste.
4. Fournir un cycle universitaire de test explicite aux renderers Planning ;
   sans cycle, leur erreur etait legitime. Aucune exception n'est supprimee.
5. Reutiliser les dependances epinglees de l'archive de production pour les
   builds locaux hors ligne. Une sortie filesystem remplace seulement le
   telechargement navigateur dans le test de serialisation Excel.
6. Corriger le comptage derive LPC3 trouve en revue au lieu de livrer des
   presences inventees. Perimetre restreint a l'affichage et au centralisateur,
   avec conservation de la note manuelle et absence de mutations.
7. Un lancement local a ete interrompu par le delai de l'outil. La suite a ete
   relancee integralement et a termine avec code 0 ; le lancement interrompu
   n'est pas compte comme reussi.
8. Ne pas fusionner ni deployer faute de recette authentifiee complete. Le cout
   est un candidat non encore accessible sur l'URL de production, plutot qu'un
   risque masque sur les comptes et donnees reels.

Detail mineur reporte : certaines valeurs tres longues d'un select natif peuvent
etre tronquees dans le champ ferme ; le label du filtre et les options restent
accessibles. Le zoom navigateur reel a 200 % reste a verifier ; le test a largeur
contrainte n'est pas presente comme equivalent.

## Conditions restantes avant production

Effectuer une recette autorisee avec sessions reelles proprietaire/autre
enseignant, persistance apres reconnexion, PIN, exports et refus serveur LPC3,
puis l'ouverture graphique du client Windows. L'acces direct a l'URL Pages est
bloque par la politique du navigateur de cet environnement
(`net::ERR_BLOCKED_BY_ADMINISTRATOR`). Aucun succes CI ne remplace cette recette.

Le nettoyage GitHub/Supabase, la release et la fusion sont suspendus a ces
conditions. La procedure de retour arriere est un revert de l'integration puis
un redeploiement ; aucune restauration de donnees n'est requise pour ce lot.
