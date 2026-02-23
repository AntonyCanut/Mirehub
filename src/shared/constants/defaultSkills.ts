import type { Locale } from '../types'

export interface DefaultSkill {
  id: string
  name: string
  description: string
  category: 'Git' | 'Development' | 'Quality' | 'Documentation' | 'Security' | 'DevOps'
  content: string
  filename: string
}

const SKILLS_EN: DefaultSkill[] = [
  {
    id: 'commit',
    name: '/commit',
    description: 'Generate a commit message automatically',
    category: 'Git',
    filename: 'commit.md',
    content: `---
description: Generate a commit message from staged changes
---

Analyze the current staged changes using \`git diff --cached\` and generate an appropriate commit message.

Rules:
1. Use Conventional Commits format (feat:, fix:, refactor:, docs:, test:, chore:)
2. First line: max 72 characters, imperative mood
3. Body: explain WHY, not WHAT (the diff shows what)
4. If multiple logical changes, suggest splitting into separate commits
5. Run \`git commit -m "message"\` with the generated message

Do NOT commit if no files are staged. Warn the user instead.
`,
  },
  {
    id: 'fix-issue',
    name: '/fix-issue',
    description: 'Fix a GitHub issue by number',
    category: 'Git',
    filename: 'fix-issue.md',
    content: `---
description: Fix a GitHub issue by number
---

$ARGUMENTS contains the issue number.

Steps:
1. Read the issue with \`gh issue view $ARGUMENTS\`
2. Analyze the codebase to understand the context
3. Implement the fix following existing code patterns
4. Write tests if applicable
5. Create a commit referencing the issue (e.g., "fix: resolve #$ARGUMENTS - description")
6. Optionally create a PR with \`gh pr create\`
`,
  },
  {
    id: 'pr-review',
    name: '/pr-review',
    description: 'Review a pull request',
    category: 'Git',
    filename: 'pr-review.md',
    content: `---
description: Review a pull request
---

$ARGUMENTS contains the PR number (optional - uses current branch PR if omitted).

Steps:
1. Get PR details: \`gh pr view $ARGUMENTS\` or \`gh pr view\`
2. Get the diff: \`gh pr diff $ARGUMENTS\`
3. Review for:
   - Bugs and edge cases
   - Security issues
   - Performance concerns
   - Code style and readability
   - Test coverage
4. Provide a structured review with actionable feedback
`,
  },
  {
    id: 'refactor',
    name: '/refactor',
    description: 'Refactoring following best practices',
    category: 'Development',
    filename: 'refactor.md',
    content: `---
description: Refactor code following best practices
---

$ARGUMENTS contains the target file or function to refactor.

Steps:
1. Read and understand the current code
2. Identify code smells (long functions, deep nesting, duplicated logic, etc.)
3. Plan the refactoring steps
4. Apply changes incrementally
5. Verify all existing tests still pass after each step
6. Run the test suite: \`npm test\` or equivalent

Principles: SOLID, DRY, KISS. Never change external behavior.
`,
  },
  {
    id: 'test',
    name: '/test',
    description: 'Generate test suites',
    category: 'Quality',
    filename: 'test.md',
    content: `---
description: Generate comprehensive test suites
---

$ARGUMENTS contains the target file or function to test.

Steps:
1. Read the target code and understand its behavior
2. Identify the testing framework in use (check package.json)
3. Write tests covering:
   - Happy path (normal usage)
   - Edge cases (empty inputs, boundaries, nulls)
   - Error scenarios (invalid inputs, network failures)
4. Follow existing test patterns in the project
5. Run the tests to verify they pass

Use descriptive test names that explain WHAT is being tested and EXPECTED behavior.
`,
  },
  {
    id: 'explain-code',
    name: '/explain-code',
    description: 'Explain code with diagrams',
    category: 'Documentation',
    filename: 'explain-code.md',
    content: `---
description: Explain code with diagrams and clear documentation
---

$ARGUMENTS contains the file or function to explain.

Provide:
1. **Overview**: What the code does and why it exists
2. **Architecture**: How it fits in the larger system
3. **Flow**: Step-by-step execution flow
4. **Key concepts**: Important patterns or algorithms used
5. **Diagram**: ASCII or Mermaid diagram of the flow/architecture
6. **Dependencies**: What it depends on and what depends on it
`,
  },
  {
    id: 'debug',
    name: '/debug',
    description: 'Debug with root cause analysis',
    category: 'Development',
    filename: 'debug.md',
    content: `---
description: Debug issues with systematic root cause analysis
---

$ARGUMENTS contains the error description or issue.

Methodology:
1. **Reproduce**: Understand the issue and how to reproduce it
2. **Isolate**: Narrow down the source (binary search through code/commits)
3. **Identify**: Find the root cause (not just the symptom)
4. **Fix**: Apply minimal, targeted fix
5. **Verify**: Confirm the fix works and doesn't break other things
6. **Prevent**: Add a test to catch regressions
`,
  },
  {
    id: 'doc-generate',
    name: '/doc-generate',
    description: 'Generate documentation',
    category: 'Documentation',
    filename: 'doc-generate.md',
    content: `---
description: Generate comprehensive project documentation
---

$ARGUMENTS contains the scope (file, module, or "project" for full docs).

Generate documentation including:
1. **README**: Project overview, setup, usage
2. **API Reference**: Functions, parameters, return types
3. **Architecture**: High-level design, module responsibilities
4. **Configuration**: Environment variables, config files
5. **Contributing**: Code style, PR process, testing requirements

Write documentation in Markdown format. Be concise and practical.
`,
  },
  {
    id: 'security-scan',
    name: '/security-scan',
    description: 'Vulnerability assessment',
    category: 'Security',
    filename: 'security-scan.md',
    content: `---
description: Perform a security vulnerability assessment
---

Scan the project for security issues:

1. **Dependencies**: Check for known vulnerabilities (\`npm audit\` or equivalent)
2. **Secrets**: Search for hardcoded API keys, passwords, tokens
3. **Injection**: Check for SQL injection, XSS, command injection risks
4. **Authentication**: Verify auth logic and session management
5. **Configuration**: Check for insecure defaults (CORS, CSP, etc.)

Output a security report with severity levels (CRITICAL/HIGH/MEDIUM/LOW) and remediation steps.
`,
  },
  {
    id: 'deploy-checklist',
    name: '/deploy-checklist',
    description: 'Pre-deployment checklist',
    category: 'DevOps',
    filename: 'deploy-checklist.md',
    content: `---
description: Generate a pre-deployment checklist
---

Analyze the project and generate a deployment checklist:

1. **Build**: Does \`npm run build\` succeed?
2. **Tests**: Do all tests pass?
3. **Types**: Does type checking pass?
4. **Lint**: Are there any lint errors?
5. **Dependencies**: Are dependencies up to date? Any vulnerabilities?
6. **Environment**: Are all required env variables documented?
7. **Database**: Any pending migrations?
8. **Breaking changes**: Any API changes that need communication?
9. **Monitoring**: Is logging and error tracking configured?
10. **Rollback**: Is the rollback plan documented?

Mark each item as PASS/FAIL/N-A with details.
`,
  },
]

const SKILLS_FR: DefaultSkill[] = [
  {
    id: 'commit',
    name: '/commit',
    description: 'Genere un message de commit automatiquement',
    category: 'Git',
    filename: 'commit.md',
    content: `---
description: Genere un message de commit depuis les changements stages
---

Analyse les changements stages avec \`git diff --cached\` et genere un message de commit appropriate.

Regles :
1. Utilise le format Conventional Commits (feat:, fix:, refactor:, docs:, test:, chore:)
2. Premiere ligne : max 72 caracteres, mode imperatif
3. Corps : explique POURQUOI, pas QUOI (le diff montre quoi)
4. Si plusieurs changements logiques, suggere de separer en commits distincts
5. Execute \`git commit -m "message"\` avec le message genere

NE committe PAS si aucun fichier n'est stage. Previens l'utilisateur.
`,
  },
  {
    id: 'fix-issue',
    name: '/fix-issue',
    description: 'Corrige un issue GitHub par numero',
    category: 'Git',
    filename: 'fix-issue.md',
    content: `---
description: Corrige un issue GitHub par numero
---

$ARGUMENTS contient le numero de l'issue.

Etapes :
1. Lis l'issue avec \`gh issue view $ARGUMENTS\`
2. Analyse le codebase pour comprendre le contexte
3. Implemente le correctif en suivant les patterns existants
4. Ecris des tests si applicable
5. Cree un commit referencant l'issue (ex: "fix: resout #$ARGUMENTS - description")
6. Optionnellement cree une PR avec \`gh pr create\`
`,
  },
  {
    id: 'pr-review',
    name: '/pr-review',
    description: 'Revue de pull request',
    category: 'Git',
    filename: 'pr-review.md',
    content: `---
description: Revue de pull request
---

$ARGUMENTS contient le numero de la PR (optionnel - utilise la PR de la branche courante si omis).

Etapes :
1. Recupere les details de la PR : \`gh pr view $ARGUMENTS\` ou \`gh pr view\`
2. Recupere le diff : \`gh pr diff $ARGUMENTS\`
3. Passe en revue :
   - Bugs et cas limites
   - Problemes de securite
   - Problemes de performance
   - Style de code et lisibilite
   - Couverture de tests
4. Fournis une revue structuree avec des retours actionnables
`,
  },
  {
    id: 'refactor',
    name: '/refactor',
    description: 'Refactoring suivant les bonnes pratiques',
    category: 'Development',
    filename: 'refactor.md',
    content: `---
description: Refactoring du code suivant les bonnes pratiques
---

$ARGUMENTS contient le fichier ou la fonction cible a refactorer.

Etapes :
1. Lis et comprends le code actuel
2. Identifie les code smells (fonctions trop longues, imbrication profonde, logique dupliquee, etc.)
3. Planifie les etapes de refactoring
4. Applique les changements incrementalement
5. Verifie que tous les tests existants passent apres chaque etape
6. Lance la suite de tests : \`npm test\` ou equivalent

Principes : SOLID, DRY, KISS. Ne jamais changer le comportement externe.
`,
  },
  {
    id: 'test',
    name: '/test',
    description: 'Genere des suites de tests',
    category: 'Quality',
    filename: 'test.md',
    content: `---
description: Genere des suites de tests completes
---

$ARGUMENTS contient le fichier ou la fonction cible a tester.

Etapes :
1. Lis le code cible et comprends son comportement
2. Identifie le framework de test utilise (verifie package.json)
3. Ecris des tests couvrant :
   - Cas nominal (utilisation normale)
   - Cas limites (entrees vides, bornes, nulls)
   - Scenarios d'erreur (entrees invalides, echecs reseau)
4. Suis les patterns de test existants dans le projet
5. Lance les tests pour verifier qu'ils passent

Utilise des noms de tests descriptifs qui expliquent CE QUI est teste et le COMPORTEMENT attendu.
`,
  },
  {
    id: 'explain-code',
    name: '/explain-code',
    description: 'Explique le code avec diagrammes',
    category: 'Documentation',
    filename: 'explain-code.md',
    content: `---
description: Explique le code avec diagrammes et documentation claire
---

$ARGUMENTS contient le fichier ou la fonction a expliquer.

Fournis :
1. **Vue d'ensemble** : Ce que fait le code et pourquoi il existe
2. **Architecture** : Comment il s'integre dans le systeme global
3. **Flux** : Flux d'execution etape par etape
4. **Concepts cles** : Patterns ou algorithmes importants utilises
5. **Diagramme** : Diagramme ASCII ou Mermaid du flux/architecture
6. **Dependances** : De quoi il depend et ce qui depend de lui
`,
  },
  {
    id: 'debug',
    name: '/debug',
    description: 'Debug avec analyse de cause racine',
    category: 'Development',
    filename: 'debug.md',
    content: `---
description: Debug des problemes avec analyse systematique de cause racine
---

$ARGUMENTS contient la description de l'erreur ou du probleme.

Methodologie :
1. **Reproduire** : Comprendre le probleme et comment le reproduire
2. **Isoler** : Reduire la source (recherche binaire dans le code/commits)
3. **Identifier** : Trouver la cause racine (pas juste le symptome)
4. **Corriger** : Appliquer un correctif minimal et cible
5. **Verifier** : Confirmer que le correctif fonctionne sans casser le reste
6. **Prevenir** : Ajouter un test pour detecter les regressions
`,
  },
  {
    id: 'doc-generate',
    name: '/doc-generate',
    description: 'Genere la documentation',
    category: 'Documentation',
    filename: 'doc-generate.md',
    content: `---
description: Genere une documentation complete du projet
---

$ARGUMENTS contient le scope (fichier, module, ou "projet" pour la doc complete).

Genere une documentation incluant :
1. **README** : Vue d'ensemble, installation, utilisation
2. **Reference API** : Fonctions, parametres, types de retour
3. **Architecture** : Design de haut niveau, responsabilites des modules
4. **Configuration** : Variables d'environnement, fichiers de config
5. **Contribution** : Style de code, processus PR, exigences de tests

Redige la documentation au format Markdown. Sois concis et pratique.
`,
  },
  {
    id: 'security-scan',
    name: '/security-scan',
    description: 'Evaluation de vulnerabilites',
    category: 'Security',
    filename: 'security-scan.md',
    content: `---
description: Realise une evaluation de vulnerabilites de securite
---

Scanne le projet pour les problemes de securite :

1. **Dependances** : Verifie les vulnerabilites connues (\`npm audit\` ou equivalent)
2. **Secrets** : Recherche les cles API, mots de passe, tokens codes en dur
3. **Injection** : Verifie les risques d'injection SQL, XSS, injection de commandes
4. **Authentification** : Verifie la logique d'auth et la gestion des sessions
5. **Configuration** : Verifie les parametres par defaut insecures (CORS, CSP, etc.)

Produis un rapport de securite avec niveaux de severite (CRITIQUE/HAUTE/MOYENNE/BASSE) et etapes de remediation.
`,
  },
  {
    id: 'deploy-checklist',
    name: '/deploy-checklist',
    description: 'Checklist pre-deploiement',
    category: 'DevOps',
    filename: 'deploy-checklist.md',
    content: `---
description: Genere une checklist pre-deploiement
---

Analyse le projet et genere une checklist de deploiement :

1. **Build** : Est-ce que \`npm run build\` reussit ?
2. **Tests** : Est-ce que tous les tests passent ?
3. **Types** : Est-ce que la verification de types passe ?
4. **Lint** : Y a-t-il des erreurs de lint ?
5. **Dependances** : Les dependances sont-elles a jour ? Des vulnerabilites ?
6. **Environnement** : Toutes les variables d'env requises sont-elles documentees ?
7. **Base de donnees** : Des migrations en attente ?
8. **Breaking changes** : Des changements d'API necessitant une communication ?
9. **Monitoring** : Le logging et le suivi d'erreurs sont-ils configures ?
10. **Rollback** : Le plan de rollback est-il documente ?

Marque chaque element comme OK/ECHEC/N-A avec des details.
`,
  },
]

export const DEFAULT_SKILLS: Record<Locale, DefaultSkill[]> = {
  en: SKILLS_EN,
  fr: SKILLS_FR,
}
