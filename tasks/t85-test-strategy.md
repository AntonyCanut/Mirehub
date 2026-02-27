# T-85 : Strategie de test - Natural Language Database Query

## Etat des lieux du setup de tests existant

### Infrastructure
- **Framework** : Vitest 3.1+ avec globals actives, environnement `node`
- **Config** : `vitest.config.ts` a la racine, alias `@shared`, `@main`, `@renderer`
- **Setup** : `tests/setup.ts` — nettoie les mocks apres chaque test (`vi.restoreAllMocks`)
- **Coverage** : v8, reporters text/html/lcov, couvre `src/**/*.ts` (exclut `src/renderer/**`)
- **Scripts** : `npm test` (run), `npm run test:watch`, `npm run test:coverage`

### Structure existante
```
tests/
  setup.ts                          # afterEach vi.restoreAllMocks
  mocks/
    electron.ts                     # createMockIpcMain, createMockBrowserWindow, createMockDialog
  helpers/
    storage.ts                      # createTestDataDir, writeTestData, readTestData
  fixtures/
    analysis/                       # Donnees de test pour analyses
  unit/
    database-service.test.ts        # DatabaseService (connect/disconnect/getDriver/disconnectAll)
    database-drivers.test.ts        # Drivers: parseConnectionString, getDefaultPort
    database-crypto.test.ts         # encryptPassword / decryptPassword
    database-backup.test.ts         # Backup service
    storage.test.ts                 # StorageService
    viewStore.test.ts               # View store
    terminalTabStore.test.ts        # Terminal tab store
    types.test.ts                   # Types validation
    updates.test.ts                 # Updates
    collapseExpand.test.ts          # UI collapse/expand logic
  integration/
    database-ipc.test.ts            # 18 handlers IPC database complets
    terminal-ipc.test.ts            # Terminal IPC
    session-ipc.test.ts             # Session IPC
    git-ipc.test.ts                 # Git IPC
    filesystem-ipc.test.ts          # FileSystem IPC
    kanban-ipc.test.ts              # Kanban IPC
    claude-ipc.test.ts              # Claude IPC
    app-ipc.test.ts                 # App IPC
    workspaceEnv-ipc.test.ts        # WorkspaceEnv IPC
    updates-ipc.test.ts             # Updates IPC
    appUpdate-ipc.test.ts           # AppUpdate IPC
    terminal-session-navigation.test.ts  # Terminal session navigation
  e2e/                              # Vide pour l'instant
```

### Patterns de mock etablis
1. **`vi.hoisted()`** pour les variables utilisees dans les factories `vi.mock`
2. **Mock IPC via `createMockIpcMain`** avec `_invoke()` pour simuler les appels renderer->main
3. **Mock `os.homedir()`** pour rediriger le stockage vers un dossier temporaire
4. **Mock electron** (dialog, safeStorage) injecte via `vi.mock('electron', ...)`
5. **Mock des drivers DB** : objets avec toutes les methodes du contrat `DbDriver`
6. **Mock du singleton `databaseService`** dans les tests d'integration IPC
7. **Nommage** : tous les noms de tests sont en francais

---

## Composants a tester pour T-85

### Nouveaux modules prevus

| Module | Couche | Type |
|--------|--------|------|
| Service NL-to-SQL | Main process | Nouveau service |
| Validation des permissions | Main process | Nouveau module |
| IPC handlers NL Query | Main process | Extension de `database.ts` ou nouveau fichier |
| Composant `DatabaseNLChat` | Renderer | Nouveau composant React |
| Systeme d'onglets (SQL / NL) | Renderer | Extension de `DatabaseQueryArea` |
| Store NL Query (sessions, onglets) | Renderer | Extension de `databaseStore` |
| Types partages (permissions, messages NL) | Shared | Extension de `types/index.ts` |

---

## Plan de tests detaille

### 1. Tests unitaires — Service NL-to-SQL

**Fichier** : `tests/unit/nl-to-sql-service.test.ts`

Le service NL-to-SQL est le coeur de la feature. Il traduit les questions en langage naturel en SQL via Claude CLI.

#### Cas a tester

**Traduction NL -> SQL :**
- Genere une requete SELECT valide a partir d'une question simple ("Combien d'utilisateurs ?")
- Genere une requete avec JOIN a partir d'une question complexe
- Genere une requete avec GROUP BY / aggregate
- Passe le schema de la base (tables, colonnes) en contexte a Claude
- Passe le dialecte SQL correct selon l'engine (PostgreSQL, MySQL, etc.)
- Retourne l'erreur Claude si la traduction echoue (timeout, API down)
- Gere les questions vides ou non pertinentes avec un message d'erreur

**Execution de la requete generee :**
- Execute le SQL genere via le driver existant
- Retourne les resultats formates
- Gere les erreurs SQL (syntaxe invalide generee par Claude)

#### Mock necessaire
```typescript
// Mock Claude CLI execution
const mockClaudeCli = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue({
    sql: 'SELECT COUNT(*) FROM users',
    explanation: 'Compte le nombre total d\'utilisateurs'
  })
}))
vi.mock('../../src/main/services/nl-query/claude-cli', () => ({
  claudeCli: mockClaudeCli
}))
```

**Strategie de mock Claude** : Le service appellera probablement Claude via `child_process.execFile` ou une commande shell. Le mock doit capturer :
- Les arguments passes (prompt avec schema, permissions, question)
- La sortie parsee (SQL + explication)
- Les cas d'erreur (timeout, stderr, code de sortie non-zero)

---

### 2. Tests unitaires — Validation des permissions

**Fichier** : `tests/unit/nl-query-permissions.test.ts`

Les permissions par connexion controlent ce que Claude peut faire (read/update/delete).

#### Cas a tester

**Validation READ (lecture seule) :**
- Autorise les SELECT
- Autorise les SELECT avec sous-requetes
- Refuse les INSERT
- Refuse les UPDATE
- Refuse les DELETE
- Refuse les DROP/ALTER/TRUNCATE
- Refuse les CREATE

**Validation UPDATE (lecture + ecriture) :**
- Autorise SELECT, INSERT, UPDATE
- Refuse DELETE
- Refuse DROP/ALTER/TRUNCATE

**Validation DELETE (tous droits) :**
- Autorise toutes les operations

**Cas limites :**
- Requetes multi-statements (SELECT puis DELETE)
- Commentaires SQL contenant des mots-cles interdits (`-- DELETE this later` ne doit pas bloquer un SELECT)
- CTES (WITH ... AS ...)
- Requetes ambigues (UPSERT = INSERT ... ON CONFLICT UPDATE)
- SQL injection dans la question NL ("Supprime tout ; DROP TABLE users")

#### Structure du test
```typescript
describe('NlQueryPermissions', () => {
  describe('permission: read', () => {
    it('autorise un SELECT simple', () => { ... })
    it('refuse un INSERT', () => { ... })
    it('refuse un UPDATE', () => { ... })
    it('refuse un DELETE', () => { ... })
    it('refuse un DROP TABLE', () => { ... })
    it('refuse les requetes multi-statements avec modification', () => { ... })
  })

  describe('permission: update', () => {
    it('autorise SELECT, INSERT, UPDATE', () => { ... })
    it('refuse DELETE', () => { ... })
    it('refuse DROP/ALTER/TRUNCATE', () => { ... })
  })

  describe('permission: delete', () => {
    it('autorise toutes les operations', () => { ... })
  })
})
```

---

### 3. Tests d'integration — IPC handlers NL Query

**Fichier** : `tests/integration/nl-query-ipc.test.ts`

Suivre le pattern exact de `database-ipc.test.ts` : mock du service, mock IPC, invocation des handlers.

#### Nouveaux channels IPC prevus

| Channel | Description |
|---------|-------------|
| `db:nlQuery` | Envoyer une question NL et recevoir la reponse (SQL + resultats) |
| `db:nlQueryHistory` | Charger l'historique des echanges d'une session |
| `db:nlQuerySessions` | Lister les sessions NL d'une connexion |
| `db:nlQuerySessionCreate` | Creer une nouvelle session NL |
| `db:nlQuerySessionDelete` | Supprimer une session NL |
| `db:listDatabases` | Deja existant - utilise pour le dropdown de selection |

#### Cas a tester

**Handler `db:nlQuery` :**
- Retourne le SQL genere + resultats quand connecte avec permission read
- Refuse l'execution si la connexion n'est pas active (`Not connected`)
- Refuse l'execution si les permissions interdisent l'operation detectee
- Gere les erreurs de traduction Claude
- Gere les erreurs d'execution SQL
- Passe le bon engine/schema a Claude
- Respecte la base de donnees selectionnee dans le dropdown

**Handler `db:nlQueryHistory` :**
- Retourne l'historique vide pour une nouvelle session
- Retourne les messages dans l'ordre chronologique
- Filtre par sessionId

**Handlers de sessions :**
- Creation d'une session avec nom par defaut
- Suppression d'une session existante
- Liste des sessions triees par date

#### Mock supplementaire
```typescript
// En plus des mocks existants de database-ipc.test.ts :
const mockNlQueryService = vi.hoisted(() => ({
  translateAndExecute: vi.fn().mockResolvedValue({
    sql: 'SELECT * FROM users LIMIT 10',
    explanation: 'Liste les 10 premiers utilisateurs',
    result: { columns: ['id', 'name'], rows: [...], rowCount: 10, executionTime: 15 }
  }),
  getHistory: vi.fn().mockReturnValue([]),
  createSession: vi.fn().mockReturnValue({ id: 'session-1', name: 'Nouvelle session', createdAt: Date.now() }),
  deleteSession: vi.fn().mockReturnValue(true),
  listSessions: vi.fn().mockReturnValue([]),
}))

vi.mock('../../src/main/services/nl-query', () => ({
  nlQueryService: mockNlQueryService
}))
```

---

### 4. Tests unitaires — Store NL Query (Zustand)

**Fichier** : `tests/unit/nl-query-store.test.ts`

Tester l'extension du `databaseStore` ou le nouveau store dedie.

#### Cas a tester

**Gestion des sessions :**
- Cree une session pour une connexion
- Selectionne une session active
- Supprime une session
- Liste les sessions d'une connexion

**Gestion des messages :**
- Ajoute un message utilisateur
- Ajoute une reponse Claude (SQL + resultats)
- Ajoute un message d'erreur
- L'historique est ordonne chronologiquement

**Gestion des onglets (SQL / NL) :**
- Par defaut l'onglet SQL est actif
- Bascule entre onglet SQL et NL
- L'etat de chaque onglet est independant par connexion

**Etat de chargement :**
- `isQuerying` passe a true pendant une requete NL
- `isQuerying` repasse a false apres la reponse
- `isQuerying` repasse a false apres une erreur

#### Pattern de test (similaire a `terminalTabStore.test.ts`)
```typescript
import { useDatabaseNlStore } from '../../src/renderer/lib/stores/databaseNlStore'
// Ou extension du databaseStore existant

describe('Database NL Store', () => {
  beforeEach(() => {
    // Reset du store Zustand entre les tests
    useDatabaseNlStore.setState(useDatabaseNlStore.getInitialState())
  })
  ...
})
```

---

### 5. Tests unitaires — Types et contrats

**Fichier** : extension de `tests/unit/types.test.ts` existant

#### Cas a tester
- Les nouveaux types `NlQueryPermission`, `NlQueryMessage`, `NlQuerySession` sont bien exportes
- Les nouveaux channels IPC sont dans `IPC_CHANNELS`
- Le type `DbConnection` supporte le nouveau champ `claudePermissions`
- Les permissions ont les valeurs attendues ('read' | 'update' | 'delete')

---

### 6. Tests de composant — DatabaseNLChat (futur)

**Note** : La config Vitest actuelle exclut `src/renderer/**` du coverage et utilise l'environnement `node`. Pour tester les composants React, il faudra :

1. **Option A** : Ajouter une config vitest separee pour le renderer avec `environment: 'jsdom'` et `@testing-library/react`
2. **Option B** : Tester uniquement la logique extraite (hooks, utils) dans l'environnement node actuel

#### Recommandation : Option B a court terme

Extraire la logique du composant `DatabaseNLChat` dans des hooks testables :
- `useNlQuerySession(connectionId)` : gestion des sessions et messages
- `useNlQueryExecution(connectionId, sessionId)` : envoi des questions, reception des reponses

Ces hooks peuvent etre testes en mockant `window.mirehub` sans avoir besoin de jsdom.

#### Cas a tester (hooks)
- Envoi d'une question declenche l'appel IPC
- Reception de la reponse met a jour l'historique
- Gestion du loading state
- Erreurs IPC remontees dans l'interface
- Le scroll suit les nouveaux messages

---

## Mocks et fixtures a creer

### 1. Mock Claude CLI (`tests/mocks/claude-cli.ts`)
```typescript
export function createMockClaudeCli() {
  return {
    execute: vi.fn().mockResolvedValue({
      sql: 'SELECT COUNT(*) FROM users',
      explanation: 'Compte les utilisateurs'
    })
  }
}
```

### 2. Fixtures schema de base (`tests/fixtures/database-schemas.ts`)
```typescript
export const MOCK_POSTGRES_SCHEMA = {
  tables: [
    {
      name: 'users',
      schema: 'public',
      columns: [
        { name: 'id', type: 'serial', isPrimaryKey: true },
        { name: 'name', type: 'varchar(255)' },
        { name: 'email', type: 'varchar(255)' },
        { name: 'created_at', type: 'timestamp' }
      ]
    },
    {
      name: 'orders',
      schema: 'public',
      columns: [
        { name: 'id', type: 'serial', isPrimaryKey: true },
        { name: 'user_id', type: 'integer', isForeignKey: true },
        { name: 'amount', type: 'numeric(10,2)' },
        { name: 'status', type: 'varchar(50)' }
      ]
    }
  ]
}
```

### 3. Fixtures messages NL (`tests/fixtures/nl-query-messages.ts`)
```typescript
export const MOCK_NL_CONVERSATION = [
  { role: 'user', content: 'Combien d\'utilisateurs ont passe une commande ?' },
  {
    role: 'assistant',
    sql: 'SELECT COUNT(DISTINCT u.id) FROM users u INNER JOIN orders o ON o.user_id = u.id',
    explanation: 'Compte les utilisateurs uniques ayant au moins une commande',
    result: { columns: ['count'], rows: [{ count: 42 }], rowCount: 1, executionTime: 8 }
  }
]
```

### 4. Fixtures permissions (`tests/fixtures/nl-query-permissions.ts`)
```typescript
export const PERMISSION_TEST_CASES = {
  readOnly: {
    allowed: ['SELECT * FROM users', 'SELECT COUNT(*) FROM orders'],
    denied: ['INSERT INTO users ...', 'UPDATE users SET ...', 'DELETE FROM users ...', 'DROP TABLE users']
  },
  readWrite: {
    allowed: ['SELECT ...', 'INSERT INTO ...', 'UPDATE ...'],
    denied: ['DELETE FROM ...', 'DROP TABLE ...', 'TRUNCATE ...']
  },
  full: {
    allowed: ['SELECT ...', 'INSERT ...', 'UPDATE ...', 'DELETE ...'],
    denied: []
  }
}
```

---

## Matrice de couverture

| Composant | Unit | Integration | Priorite |
|-----------|------|-------------|----------|
| Service NL-to-SQL | X | | HAUTE |
| Validation permissions | X | | HAUTE |
| IPC handlers NL Query | | X | HAUTE |
| Store NL Query | X | | MOYENNE |
| Types/contrats | X | | BASSE |
| Hooks NL Chat | X | | MOYENNE |

---

## Ordre d'implementation des tests

1. **Types et contrats** — valider que les interfaces existent avant de les utiliser
2. **Validation des permissions** — module isole, pas de dependances, critique pour la securite
3. **Service NL-to-SQL** — coeur de la feature, necessite le mock Claude CLI
4. **IPC handlers** — integration service + permissions + handlers
5. **Store NL Query** — etat renderer
6. **Hooks NL Chat** — logique UI extractible

---

## Risques identifies

1. **Mock Claude CLI** : La facon dont Claude est appele (CLI, API, subprocess) influencera fortement le mock. A valider avec l'architecte.
2. **Validation SQL** : Parser du SQL pour detecter les operations (SELECT vs DELETE) est non trivial. Il faudra probablement un parser simple ou des regex robustes. Les tests devront couvrir les cas limites (CTE, sous-requetes, multi-statements).
3. **Tests renderer** : L'absence de jsdom dans la config actuelle limite les tests de composants React. Recommandation : extraire la logique dans des hooks testables.
4. **Sessions NL** : La persistance des sessions (memoire vs disque) influencera les tests d'integration. A clarifier avec l'architecte.
