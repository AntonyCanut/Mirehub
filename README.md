# Mirehub

Environnement de developpement integre pour macOS, propulse par Electron et Claude AI. Workspaces combine un terminal multi-onglets, la gestion de projets, un tableau Kanban intelligent et des outils Git complets dans une interface native macOS.

## Fonctionnalites

- **Terminal integre** — Emulateur xterm.js avec node-pty, multi-onglets et jusqu'a 4 panneaux divises par onglet
- **Gestion de workspaces** — Projets isoles via environnements virtuels (`~/.workspaces/{name}` par symlinks)
- **Integration Git complete** — Status, branches, commits, diff, stash, merge, fetch (21 canaux IPC)
- **Tableau Kanban** — 5 colonnes (TODO, WORKING, PENDING, DONE, FAILED) avec integration Claude AI
- **Sessions Claude Code** — Jusqu'a 4 agents AI concurrents par projet, mode boucle
- **Gestion NPM** — Visualisation des paquets et verification de versions
- **Editeur Monaco** — Visualisation et edition de fichiers avec coloration syntaxique
- **Explorateur de fichiers** — Arborescence de repertoires navigable
- **Persistance** — Recuperation de session et stockage JSON (`~/.mirehub/data.json`)
- **Auto-Clauder** — Deploiement automatique de la configuration `.claude`
- **Interface macOS native** — Barre de titre personnalisee, vibrancy, polices systeme

## Stack technique

| Categorie | Technologie | Version |
|---|---|---|
| Framework | Electron | 33.0.0 |
| UI | React | 19.1.0 |
| Langage | TypeScript | 5.8.0 |
| Build | Vite | 6.3.0 |
| Etat | Zustand | 5.0.0 |
| Terminal | node-pty + xterm.js | 1.0.0 / 6.0.0 |
| Editeur | Monaco Editor | 0.55.1 |
| Persistance | electron-store | 10.0.0 |
| Tests | Vitest | 3.1.0 |
| Qualite | ESLint + Prettier | — |
| Packaging | electron-builder | 26.0.0 |

## Prerequis

- **macOS** (application native macOS uniquement)
- **Node.js** LTS (>= 20)
- **npm** (inclus avec Node.js)
- **Claude Code** (optionnel, pour les fonctionnalites AI)

## Installation

```bash
git clone https://github.com/akc/workspaces.git
cd workspaces
npm install
```

## Demarrage rapide

```bash
npm run dev
```

L'application demarre avec le serveur Vite en mode developpement avec hot reload.

## Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de developpement avec hot reload |
| `npm run build` | Compilation de tous les processus |
| `npm run build:app` | Build complet + packaging macOS DMG |
| `npm run lint` | Verification ESLint |
| `npm run lint:fix` | Correction automatique ESLint |
| `npm run format` | Formatage Prettier |
| `npm test` | Lancer les tests (Vitest) |
| `npm run test:watch` | Tests en mode surveillance |
| `npm run test:coverage` | Tests avec rapport de couverture |
| `npm run typecheck` | Verification de types TypeScript |

Un `Makefile` est egalement disponible avec des cibles equivalentes ainsi que `install` et `clean`.

## Structure du projet

```
src/
  main/                 # Processus principal Electron
    index.ts            # Initialisation, creation de fenetre, enregistrement IPC
    ipc/                # 11 modules de handlers IPC
                        #   app, terminal, workspace, project, git, filesystem,
                        #   claude, kanban, updates, session, workspaceEnv
    services/
      storage.ts        # Persistance JSON singleton (~/.mirehub/data.json)
  preload/
    index.ts            # API contextBridge (window.mirehub)
  renderer/             # Processus renderer (React)
    App.tsx             # Composant racine
    main.tsx            # Point d'entree React
    components/         # 27 composants React (structure plate)
    lib/
      stores/           # 6 stores Zustand
                        #   workspace, terminalTab, kanban, claude, view, update
      monacoSetup.ts    # Configuration Monaco Editor
    styles/             # 7 fichiers CSS
  shared/
    types/index.ts      # Interfaces TypeScript partagees
    constants/defaults.ts # Parametres par defaut
tests/
  unit/                 # 7 fichiers de tests unitaires
  integration/          # 14 fichiers de tests d'integration
  mocks/                # Mock Electron
  helpers/              # Utilitaires de test
```

## Tests

Lancer les tests unitaires et d'integration :

```bash
npm test
```

Avec rapport de couverture :

```bash
npm run test:coverage
```

Les tests utilisent Vitest avec des mocks Electron pour simuler les canaux IPC et les services du processus principal.

## Build macOS

Generer un fichier DMG pour distribution :

```bash
npm run build:app
```

Le DMG est produit via electron-builder avec `hardenedRuntime` active. L'application est categorisee comme outil de developpement (`public.app-category.developer-tools`).

## Documentation

- [Architecture](ARCHITECTURE.md) — Vue d'ensemble de l'architecture et decisions techniques
- [API IPC](docs/IPC-API.md) — Reference des 70+ canaux IPC
- [Composants](docs/COMPONENTS.md) — Catalogue des 27 composants React
- [Stores Zustand](docs/STORES.md) — Documentation des 6 stores de gestion d'etat
- [Raccourcis clavier](docs/KEYBOARD-SHORTCUTS.md) — Reference complete des raccourcis
- [Securite](docs/SECURITY.md) — Guide securite Electron
- [Tests](docs/TESTING.md) — Guide et strategies de test
- [Contribution](docs/CONTRIBUTING.md) — Guide de contribution au projet

## Licence

[MIT](LICENSE) — akc
