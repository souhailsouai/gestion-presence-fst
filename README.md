# Gestion de Présence des TP — FST

Application de gestion de présence des travaux pratiques (Faculté des Sciences de Tunis, 2026/2027).

## Contenu

| Dossier | Rôle |
|---|---|
| `index.html`, `web/`, `shared/` | Site web (publié sur GitHub Pages) |
| `scripts/build_pages_from_41881.py` | Construction du site publié (`web/index.html`) |
| `web/android/` | Application Android publiée (APK + `latest.json` pour la mise à jour intégrée) |
| `app-native/` | Code de l'application Android native (Kotlin, Jetpack Compose) |
| `supabase/` | Migrations de la base de données |
| `tests/` | Tests du site (`node --test tests/web/*.test.cjs`, `pytest tests/browser`) |

## Construire

- Site : `python3 scripts/build_pages_from_41881.py`
- Application : `gradle :app-native:assembleFast` (version optimisée) ou `:app-native:assembleDebug`

Aucune donnée personnelle (listes d'étudiants, fichiers Excel ou CSV) ne doit être ajoutée au dépôt.
