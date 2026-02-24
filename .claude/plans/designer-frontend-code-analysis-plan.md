# Plan UI/UX - Onglet Code Analysis (T-23)

## 1. Analyse des patterns existants

Apres etude des composants existants, voici les patterns a respecter :

- **Layout sidebar + contenu** : utilise par `ApiTesterPanel` (240px sidebar, `flex: 1` contenu) et `DatabaseExplorer` (meme pattern avec DatabaseSidebar + DatabaseQueryArea)
- **Header avec filtres** : pattern TodoScanner (header h3 + count + refresh, barre de filtres avec boutons toggle)
- **Liste avec groupes collapsibles** : pattern TodoScanner (groupBy file, chevron toggle, badge count)
- **Badges de type/statut** : pattern `todo-scanner-type-badge` (font 9px, bold, background alpha 20, border-radius 3px)
- **Boutons filtre** : pattern `todo-filter-btn` (24px height, 11px font, border var(--border), active = accent)
- **CSS Variables** : `--bg-primary`, `--bg-secondary`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--danger`, `--success`, `--warning`, `--border`
- **Prefixe CSS** : chaque composant utilise un prefixe unique (`todo-scanner-`, `api-`, `db-`, `npm-`)
- **Kanban integration** : `kanbanStore.createTask(workspaceId, title, description, priority, targetProjectId?)`

## 2. Structure du composant principal

```
CodeAnalysisPanel (ca-panel)
├── ca-panel-header          -- Header global (titre, counts, bouton run all, refresh)
├── ca-panel-body             -- flex row
│   ├── ca-sidebar            -- 240px, sidebar gauche
│   │   ├── ca-sidebar-header -- "Outils" + actions
│   │   ├── ca-tool-list      -- Liste des outils d'analyse
│   │   │   └── ca-tool-item  -- Un outil (nom, statut install, toggle)
│   │   ├── ca-sidebar-divider
│   │   ├── ca-reports-header -- "Rapports" + count
│   │   └── ca-report-list    -- Historique des rapports
│   │       └── ca-report-item -- Un rapport (date, outils, count findings)
│   └── ca-content            -- flex: 1, zone principale
│       ├── ca-filters        -- Barre de filtres (severite, outil, fichier)
│       ├── ca-progress       -- Barre de progression (visible pendant analyse)
│       ├── ca-findings-list  -- Liste des findings groupes
│       │   └── ca-file-group -- Groupe par fichier (collapsible)
│       │       ├── ca-file-header -- Chemin fichier + count + checkbox select all
│       │       └── ca-finding-item -- Un finding individuel
│       └── ca-selection-bar  -- Barre d'action flottante (quand findings selectionnes)
└── ca-empty-state            -- Etat initial (pas de projet / pas d'analyse)
```

## 3. Design detaille de chaque zone

### 3.1 Header (ca-panel-header)

Pattern : identique a `todo-scanner-header` et `npm-panel-header`.

```
[h3 "Analyse de code"] [count "142 problemes"] [spacer] [btn "Lancer l'analyse" primary] [btn refresh]
```

- h3 : 13px, font-weight 600, --text-primary
- count : 11px, --text-muted, margin-left auto
- Bouton "Lancer l'analyse" : style accent, disabled pendant l'execution
- Bouton refresh : 24x24, --text-muted, hover --bg-surface

### 3.2 Sidebar - Outils (ca-sidebar, ca-tool-list)

Pattern : inspire de `api-sidebar` (240px, --bg-secondary, border-right).

**Section Outils :**
```
┌────────────────────────┐
│ Outils                 │
├────────────────────────┤
│ ● semgrep      [actif] │  -- vert = installe et actif
│ ● eslint       [actif] │  -- checkbox pour activer/desactiver
│ ○ bandit    [installer] │  -- gris = pas installe, lien installer
│ ○ trivy     [installer] │
│ ● stylelint    [actif] │
└────────────────────────┘
```

Chaque `ca-tool-item` :
- Indicateur de statut : cercle plein (installe) ou vide (pas installe)
  - Installe : `--success` (vert)
  - Non installe : `--text-muted` (gris)
- Nom de l'outil : 12px, --text-primary
- Action a droite :
  - Si installe : checkbox toggle (activer/desactiver pour l'analyse)
  - Si non installe : bouton "Installer" petit, style lien accent

**Section Rapports :**
```
┌────────────────────────┐
│ Rapports          (3)  │
├────────────────────────┤
│ 24/02 14:30   12 items │  -- rapport selectionne = --bg-surface
│ 24/02 10:15   45 items │
│ 23/02 18:00    8 items │
└────────────────────────┘
```

Chaque `ca-report-item` :
- Date : 11px, --text-secondary
- Count findings : 11px, --text-muted, align right
- Outils utilises : 10px, badges compacts sous la date
- Selection : background --bg-surface quand actif

### 3.3 Barre de filtres (ca-filters)

Pattern : identique a `todo-scanner-filters` et `npm-panel-filters`.

```
[Tous (142)] [Critique (3)] [Haute (12)] [Moyenne (45)] [Basse (67)] [Info (15)] | [semgrep] [eslint] | [recherche fichier...]
```

- Filtres de severite : boutons toggle, meme style que `todo-filter-btn`
  - Critique : borderColor `--danger` quand actif
  - Haute : borderColor `--warning` quand actif
  - Moyenne : borderColor `--accent` quand actif
  - Basse : borderColor `--text-secondary` quand actif
  - Info : borderColor `--text-muted` quand actif
- Filtres d'outil : boutons toggle apres un separateur vertical
- Recherche fichier : input texte compact, 150px, style --bg-surface

### 3.4 Barre de progression (ca-progress)

Visible uniquement pendant l'analyse. Pattern simple et non-intrusif.

```
┌──────────────────────────────────────────────────────┐
│ Analyse en cours... semgrep (2/4 outils)  [====>   ] │
└──────────────────────────────────────────────────────┘
```

- Conteneur : padding 8px 14px, background --bg-secondary, border-bottom --border
- Texte : 12px, --text-secondary
- Outil courant : --accent, font-weight 500
- Barre : 4px height, background --bg-surface, fill --accent, border-radius 2px
- Pourcentage : 11px, --text-muted, align right

### 3.5 Liste des findings (ca-findings-list)

Pattern : identique a `todo-scanner-list` avec groupes par fichier.

**Groupe fichier (ca-file-group) :**
```
▶ src/renderer/App.tsx                    (12)  [☐]
  ├─ [CRITICAL] semgrep  :42  Insecure eval() usage          [☐]
  ├─ [HIGH]     eslint   :78  Missing error boundary          [☐]
  └─ [MEDIUM]   semgrep  :156 Unused variable assignment      [☐]
```

`ca-file-header` (pattern `todo-scanner-file-header`) :
- Chevron : rotation 0/90deg comme TodoScanner
- Nom fichier : 12px, font-family monospace, --text-primary
- Count : badge rond, 11px, --bg-surface, --text-muted
- Checkbox : pour selection de groupe (selectionne tous les findings du fichier)

`ca-finding-item` (pattern `todo-scanner-entry`) :
- Clickable : ouvre le fichier a la ligne (via `openFile(path, line)`)
- Layout : flex row, align center, gap 8px, padding 4px 8px
- Composants de gauche a droite :
  1. **Checkbox** : 14x14, --border, checked = --accent
  2. **Badge severite** : style `todo-scanner-type-badge` avec couleurs mappees
     - CRITICAL : background `var(--danger)20`, color `var(--danger)`
     - HIGH : background `var(--warning)20`, color `var(--warning)`
     - MEDIUM : background `var(--accent)20`, color `var(--accent)`
     - LOW : background `var(--text-secondary)20`, color `var(--text-secondary)`
     - INFO : background `var(--text-muted)20`, color `var(--text-muted)`
  3. **Nom outil** : 10px, --text-muted, largeur fixe 60px
  4. **Ligne** : 10px, monospace, --text-muted, prefixe ":"
  5. **Message** : 12px, --text-primary, text-overflow ellipsis
- Hover : background --bg-surface, cursor pointer

### 3.6 Barre de selection (ca-selection-bar)

Barre d'action flottante en bas du contenu, visible uniquement quand >= 1 finding est selectionne.

```
┌─────────────────────────────────────────────────────────────┐
│ 3 problemes selectionnes  [Creer tickets Kanban]  [Desel.] │
└─────────────────────────────────────────────────────────────┘
```

- Position : sticky bottom 0, background --bg-secondary, border-top --border
- Padding : 8px 14px
- Count : 12px, --text-primary
- Bouton "Creer tickets Kanban" : style accent (background --accent, color white, border-radius 4px)
  - Action : pour chaque finding selectionne, appelle `kanbanStore.createTask()` avec :
    - title : `[{severity}] {toolName}: {message}` (tronque a 80 chars)
    - description : `Fichier: {file}\nLigne: {line}\n\nMessage: {fullMessage}\n\nOutil: {tool}\nRegle: {ruleId}`
    - priority : mapping severity -> priority (CRITICAL->critical, HIGH->high, MEDIUM->medium, LOW/INFO->low)
- Bouton "Deselectionner" : style ghost, --text-muted

### 3.7 Etats vides

**Pas de projet actif :**
```
Selectionnez un projet pour lancer une analyse de code.
```
Style : `ca-empty-state`, flex center, --text-muted, 13px, italic (identique a todo-scanner-empty).

**Pas d'analyse :**
```
Aucune analyse effectuee.
Lancez une analyse en cliquant sur "Lancer l'analyse".
```

**Analyse sans resultats :**
```
Aucun probleme detecte. Votre code est propre !
```

## 4. Fichier CSS : `code-analysis.css`

Prefixe : `ca-` pour toutes les classes.

Regles principales a respecter :
- Utiliser exclusivement les CSS variables existantes
- Memes dimensions et espacements que les patterns existants (13px h3, 11px counts, 24px boutons, 4px gap filtres)
- Transitions : `all 0.15s ease` partout (coherent avec le reste)
- Pas de Tailwind, pas de CSS-in-JS
- Border-radius : 4px pour les boutons, 3px pour les badges
- Import dans global.css ou dans le composant via import

## 5. Composants React

Fichier unique : `CodeAnalysisPanel.tsx` (comme TodoScanner, NpmPanel).

Sous-composants internes (fonctions dans le meme fichier, comme `DatabaseLogPanel`) :
- `ToolListItem` : un outil dans la sidebar
- `ReportListItem` : un rapport dans la sidebar
- `FindingGroup` : groupe de findings par fichier
- `FindingItem` : un finding individuel
- `SelectionBar` : barre d'action flottante

Pas de decomposition en fichiers separes sauf si le fichier depasse ~500 lignes.

## 6. Interactions et UX

| Action | Comportement |
|--------|-------------|
| Clic "Lancer l'analyse" | Lance les outils actifs, affiche la progression, desactive le bouton |
| Clic sur un finding | Ouvre le fichier source a la ligne via `openFile(path, line)` |
| Checkbox finding | Ajoute/retire de la selection, affiche la barre de selection |
| Checkbox file header | Selectionne/deselectionne tous les findings du fichier |
| "Creer tickets Kanban" | Cree un ticket par finding selectionne, affiche feedback succes |
| Filtre severite | Toggle inclusif (plusieurs severites activables) |
| Filtre outil | Toggle inclusif |
| Recherche fichier | Filtre les groupes de fichiers par substring |
| Clic rapport sidebar | Charge le rapport et affiche ses findings |
| Toggle outil sidebar | Active/desactive l'outil pour la prochaine analyse |

## 7. Strategie de tests

- Tests unitaires : filtrage, groupement, mapping severity->priority, creation de titres tickets
- Tests d'integration : interaction checkbox -> barre de selection, creation tickets kanban
- Tests visuels : screenshot du composant dans les etats cles (vide, en cours, avec resultats, avec selection)

## 8. Accessibilite

- Checkboxes : labels aria pour lecteurs d'ecran
- Filtres : role="group" avec aria-label
- Findings cliquables : role="button" ou element button natif
- Barre de progression : role="progressbar" avec aria-valuenow
- Couleurs : badges utilisent background+couleur (pas couleur seule) pour daltoniens
- Navigation clavier : Tab pour naviguer, Enter/Space pour activer
