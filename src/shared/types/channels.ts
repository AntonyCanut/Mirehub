// IPC Channel types

export const IPC_CHANNELS = {
  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_INPUT: 'terminal:input',

  // Workspace
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_CREATE: 'workspace:create',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_PERMANENT_DELETE: 'workspace:permanentDelete',
  WORKSPACE_CHECK_DELETED: 'workspace:checkDeleted',
  WORKSPACE_RESTORE: 'workspace:restore',

  // Project
  PROJECT_LIST: 'project:list',
  PROJECT_ADD: 'project:add',
  PROJECT_REMOVE: 'project:remove',
  PROJECT_SCAN_CLAUDE: 'project:scanClaude',
  PROJECT_SELECT_DIR: 'project:selectDir',

  // Claude
  CLAUDE_START: 'claude:start',
  CLAUDE_STOP: 'claude:stop',
  CLAUDE_STATUS: 'claude:status',
  CLAUDE_SESSION_END: 'claude:sessionEnd',

  // Kanban
  KANBAN_LIST: 'kanban:list',
  KANBAN_CREATE: 'kanban:create',
  KANBAN_UPDATE: 'kanban:update',
  KANBAN_DELETE: 'kanban:delete',
  KANBAN_WRITE_PROMPT: 'kanban:writePrompt',
  KANBAN_CLEANUP_PROMPT: 'kanban:cleanupPrompt',
  KANBAN_GET_PATH: 'kanban:getPath',
  KANBAN_SELECT_FILES: 'kanban:selectFiles',
  KANBAN_ATTACH_FILE: 'kanban:attachFile',
  KANBAN_ATTACH_FROM_CLIPBOARD: 'kanban:attachFromClipboard',
  KANBAN_REMOVE_ATTACHMENT: 'kanban:removeAttachment',
  KANBAN_GET_WORKING_TICKET: 'kanban:getWorkingTicket',
  KANBAN_WATCH: 'kanban:watch',
  KANBAN_UNWATCH: 'kanban:unwatch',
  KANBAN_WATCH_ADD: 'kanban:watchAdd',
  KANBAN_WATCH_REMOVE: 'kanban:watchRemove',
  KANBAN_FILE_CHANGED: 'kanban:fileChanged',
  KANBAN_LINK_CONVERSATION: 'kanban:linkConversation',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_UNINSTALL: 'update:uninstall',
  UPDATE_STATUS: 'update:status',

  // Auto-Clauder
  AUTOCLAUDE_APPLY: 'autoclaude:apply',
  AUTOCLAUDE_TEMPLATES: 'autoclaude:templates',

  // Project info
  PROJECT_SCAN_INFO: 'project:scanInfo',
  PROJECT_DEPLOY_CLAUDE: 'project:deployClaude',
  PROJECT_CHECK_CLAUDE: 'project:checkClaude',
  PROJECT_CHECK_PACKAGES: 'project:checkPackages',
  PROJECT_UPDATE_PACKAGE: 'project:updatePackage',

  // File system
  FS_READ_DIR: 'fs:readDir',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_COPY: 'fs:copy',
  FS_MKDIR: 'fs:mkdir',
  FS_EXISTS: 'fs:exists',
  FS_READ_BASE64: 'fs:readBase64',
  FS_OPEN_IN_FINDER: 'fs:openInFinder',
  FS_SEARCH: 'fs:search',

  // Git
  GIT_INIT: 'git:init',
  GIT_STATUS: 'git:status',
  GIT_LOG: 'git:log',
  GIT_BRANCHES: 'git:branches',
  GIT_CHECKOUT: 'git:checkout',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_COMMIT: 'git:commit',
  GIT_DIFF: 'git:diff',
  GIT_STASH: 'git:stash',
  GIT_STASH_POP: 'git:stashPop',
  GIT_CREATE_BRANCH: 'git:createBranch',
  GIT_DELETE_BRANCH: 'git:deleteBranch',
  GIT_MERGE: 'git:merge',
  GIT_FETCH: 'git:fetch',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DISCARD: 'git:discard',
  GIT_SHOW: 'git:show',
  GIT_STASH_LIST: 'git:stashList',
  GIT_RENAME_BRANCH: 'git:renameBranch',
  GIT_TAGS: 'git:tags',
  GIT_CREATE_TAG: 'git:createTag',
  GIT_DELETE_TAG: 'git:deleteTag',
  GIT_CHERRY_PICK: 'git:cherryPick',
  GIT_DIFF_BRANCHES: 'git:diffBranches',
  GIT_BLAME: 'git:blame',
  GIT_REMOTES: 'git:remotes',
  GIT_ADD_REMOTE: 'git:addRemote',
  GIT_REMOVE_REMOTE: 'git:removeRemote',
  GIT_RESET_SOFT: 'git:resetSoft',

  // Workspace storage (.workspaces dir)
  WORKSPACE_INIT_DIR: 'workspace:initDir',

  // Session
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',
  SESSION_CLEAR: 'session:clear',

  // Workspace env (virtual env with symlinks)
  WORKSPACE_ENV_SETUP: 'workspace:envSetup',
  WORKSPACE_ENV_PATH: 'workspace:envPath',
  WORKSPACE_ENV_DELETE: 'workspace:envDelete',

  // Project Claude write
  PROJECT_WRITE_CLAUDE_SETTINGS: 'project:writeClaudeSettings',
  PROJECT_WRITE_CLAUDE_MD: 'project:writeClaudeMd',

  // Project scanning (TODO scanner, stats)
  PROJECT_SCAN_TODOS: 'project:scanTodos',
  PROJECT_LOAD_IGNORED_TODOS: 'project:loadIgnoredTodos',
  PROJECT_SAVE_IGNORED_TODOS: 'project:saveIgnoredTodos',
  PROJECT_STATS: 'project:stats',

  // Project notes
  PROJECT_GET_NOTES: 'project:getNotes',
  PROJECT_SAVE_NOTES: 'project:saveNotes',

  // Namespace
  NAMESPACE_LIST: 'namespace:list',
  NAMESPACE_CREATE: 'namespace:create',
  NAMESPACE_UPDATE: 'namespace:update',
  NAMESPACE_DELETE: 'namespace:delete',
  NAMESPACE_ENSURE_DEFAULT: 'namespace:ensureDefault',

  // Git Config (per-namespace profiles)
  GIT_CONFIG_GET: 'gitConfig:get',
  GIT_CONFIG_SET: 'gitConfig:set',
  GIT_CONFIG_DELETE: 'gitConfig:delete',

  // Workspace export/import
  WORKSPACE_EXPORT: 'workspace:export',
  WORKSPACE_IMPORT: 'workspace:import',

  // Prompt templates
  PROMPTS_LIST: 'prompts:list',
  PROMPTS_CREATE: 'prompts:create',
  PROMPTS_UPDATE: 'prompts:update',
  PROMPTS_DELETE: 'prompts:delete',

  // Claude agents & skills
  CLAUDE_LIST_AGENTS: 'claude:listAgents',
  CLAUDE_READ_AGENT: 'claude:readAgent',
  CLAUDE_WRITE_AGENT: 'claude:writeAgent',
  CLAUDE_DELETE_AGENT: 'claude:deleteAgent',
  CLAUDE_LIST_SKILLS: 'claude:listSkills',
  CLAUDE_READ_SKILL: 'claude:readSkill',
  CLAUDE_WRITE_SKILL: 'claude:writeSkill',
  CLAUDE_DELETE_SKILL: 'claude:deleteSkill',
  CLAUDE_RENAME_AGENT: 'claude:renameAgent',
  CLAUDE_RENAME_SKILL: 'claude:renameSkill',

  // Claude defaults library
  CLAUDE_DEFAULTS_PROFILES: 'claude:defaultsProfiles',
  CLAUDE_DEFAULTS_SKILLS: 'claude:defaultsSkills',
  CLAUDE_DEPLOY_PROFILE: 'claude:deployProfile',
  CLAUDE_DEPLOY_SKILL: 'claude:deploySkill',
  CLAUDE_CHECK_DEPLOYED: 'claude:checkDeployed',

  // Claude activity hooks
  CLAUDE_ACTIVITY: 'claude:activity',
  CLAUDE_INSTALL_HOOKS: 'claude:installHooks',
  CLAUDE_CHECK_HOOKS: 'claude:checkHooks',
  CLAUDE_VALIDATE_SETTINGS: 'claude:validateSettings',
  CLAUDE_FIX_SETTINGS: 'claude:fixSettings',
  CLAUDE_REMOVE_HOOKS: 'claude:removeHooks',
  CLAUDE_CHECK_HOOKS_STATUS: 'claude:checkHooksStatus',
  CLAUDE_EXPORT_CONFIG: 'claude:exportConfig',
  CLAUDE_IMPORT_CONFIG: 'claude:importConfig',
  CLAUDE_MEMORY_READ_AUTO: 'claude:memoryReadAuto',
  CLAUDE_MEMORY_TOGGLE_AUTO: 'claude:memoryToggleAuto',
  CLAUDE_MEMORY_LIST_RULES: 'claude:memoryListRules',
  CLAUDE_MEMORY_READ_RULE: 'claude:memoryReadRule',
  CLAUDE_MEMORY_WRITE_RULE: 'claude:memoryWriteRule',
  CLAUDE_MEMORY_DELETE_RULE: 'claude:memoryDeleteRule',
  CLAUDE_MEMORY_READ_FILE: 'claude:memoryReadFile',
  CLAUDE_MEMORY_WRITE_FILE: 'claude:memoryWriteFile',
  CLAUDE_MEMORY_READ_MANAGED: 'claude:memoryReadManaged',
  CLAUDE_MEMORY_INIT: 'claude:memoryInit',
  CLAUDE_MEMORY_EXPORT_RULES: 'claude:memoryExportRules',
  CLAUDE_MEMORY_IMPORT_RULES: 'claude:memoryImportRules',
  CLAUDE_MEMORY_LIST_SHARED_RULES: 'claude:memoryListSharedRules',
  CLAUDE_MEMORY_WRITE_SHARED_RULE: 'claude:memoryWriteSharedRule',
  CLAUDE_MEMORY_DELETE_SHARED_RULE: 'claude:memoryDeleteSharedRule',
  CLAUDE_MEMORY_LINK_SHARED_RULE: 'claude:memoryLinkSharedRule',
  CLAUDE_MEMORY_UNLINK_SHARED_RULE: 'claude:memoryUnlinkSharedRule',
  CLAUDE_MEMORY_INIT_DEFAULT_RULES: 'claude:memoryInitDefaultRules',

  // Claude rules tree management
  CLAUDE_MEMORY_MOVE_RULE: 'claude:memoryMoveRule',
  CLAUDE_MEMORY_CREATE_RULE_DIR: 'claude:memoryCreateRuleDir',
  CLAUDE_MEMORY_RENAME_RULE_DIR: 'claude:memoryRenameRuleDir',
  CLAUDE_MEMORY_DELETE_RULE_DIR: 'claude:memoryDeleteRuleDir',
  CLAUDE_MEMORY_LIST_TEMPLATES: 'claude:memoryListTemplates',
  CLAUDE_MEMORY_READ_TEMPLATE: 'claude:memoryReadTemplate',
  CLAUDE_MEMORY_IMPORT_TEMPLATES: 'claude:memoryImportTemplates',
  CLAUDE_MEMORY_SYNC_AI_RULES: 'claude:memorySyncAiRules',
  CLAUDE_MEMORY_CHECK_AI_RULES: 'claude:memoryCheckAiRules',

  // Claude settings hierarchy
  PROJECT_READ_CLAUDE_LOCAL_SETTINGS: 'project:readClaudeLocalSettings',
  PROJECT_WRITE_CLAUDE_LOCAL_SETTINGS: 'project:writeClaudeLocalSettings',
  PROJECT_READ_USER_CLAUDE_SETTINGS: 'project:readUserClaudeSettings',
  PROJECT_WRITE_USER_CLAUDE_SETTINGS: 'project:writeUserClaudeSettings',
  PROJECT_READ_MANAGED_SETTINGS: 'project:readManagedSettings',

  // MCP
  MCP_GET_HELP: 'mcp:getHelp',

  // API Tester
  API_EXECUTE: 'api:execute',
  API_LOAD: 'api:load',
  API_SAVE: 'api:save',
  API_EXPORT: 'api:export',
  API_IMPORT: 'api:import',

  // Health Check
  HEALTHCHECK_LOAD: 'healthcheck:load',
  HEALTHCHECK_SAVE: 'healthcheck:save',
  HEALTHCHECK_EXECUTE: 'healthcheck:execute',
  HEALTHCHECK_START_SCHEDULER: 'healthcheck:startScheduler',
  HEALTHCHECK_STOP_SCHEDULER: 'healthcheck:stopScheduler',
  HEALTHCHECK_UPDATE_INTERVAL: 'healthcheck:updateInterval',
  HEALTHCHECK_STATUS: 'healthcheck:status',
  HEALTHCHECK_STATUS_UPDATE: 'healthcheck:statusUpdate',
  HEALTHCHECK_EXPORT: 'healthcheck:export',
  HEALTHCHECK_IMPORT: 'healthcheck:import',
  HEALTHCHECK_CLEAR_HISTORY: 'healthcheck:clearHistory',

  // Database Explorer
  DB_CONNECT: 'db:connect',
  DB_DISCONNECT: 'db:disconnect',
  DB_TEST_CONNECTION: 'db:testConnection',
  DB_LIST_DATABASES: 'db:listDatabases',
  DB_LIST_SCHEMAS: 'db:listSchemas',
  DB_LIST_TABLES: 'db:listTables',
  DB_TABLE_INFO: 'db:tableInfo',
  DB_EXECUTE_QUERY: 'db:executeQuery',
  DB_CANCEL_QUERY: 'db:cancelQuery',
  DB_LOAD: 'db:load',
  DB_SAVE: 'db:save',
  DB_EXPORT: 'db:export',
  DB_IMPORT: 'db:import',
  DB_BACKUP: 'db:backup',
  DB_BACKUP_LIST: 'db:backupList',
  DB_BACKUP_DELETE: 'db:backupDelete',
  DB_RESTORE: 'db:restore',
  DB_TRANSFER: 'db:transfer',
  DB_QUERY_PROGRESS: 'db:queryProgress',
  DB_BACKUP_LOG: 'db:backupLog',
  DB_NL_QUERY: 'db:nlQuery',
  DB_NL_GENERATE_SQL: 'db:nlGenerateSql',
  DB_NL_INTERPRET: 'db:nlInterpret',
  DB_NL_CANCEL: 'db:nlCancel',
  DB_GET_SCHEMA_CONTEXT: 'db:getSchemaContext',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',

  // App
  APP_SETTINGS_GET: 'app:settingsGet',
  APP_SETTINGS_SET: 'app:settingsSet',
  APP_NOTIFICATION: 'app:notification',
  APP_VERSION: 'app:version',

  // App Update (electron-updater)
  APP_UPDATE_CHECK: 'appUpdate:check',
  APP_UPDATE_DOWNLOAD: 'appUpdate:download',
  APP_UPDATE_INSTALL: 'appUpdate:install',
  APP_UPDATE_STATUS: 'appUpdate:status',

  // Menu
  MENU_ACTION: 'menu:action',

  // SSH Keys
  SSH_LIST_KEYS: 'ssh:listKeys',
  SSH_GENERATE_KEY: 'ssh:generateKey',
  SSH_READ_PUBLIC_KEY: 'ssh:readPublicKey',
  SSH_IMPORT_KEY: 'ssh:importKey',
  SSH_DELETE_KEY: 'ssh:deleteKey',
  SSH_OPEN_DIRECTORY: 'ssh:openDirectory',
  SSH_SELECT_KEY_FILE: 'ssh:selectKeyFile',

  // Packages (multi-technology)
  PACKAGES_DETECT: 'packages:detect',
  PACKAGES_LIST: 'packages:list',
  PACKAGES_UPDATE: 'packages:update',
  PACKAGES_SEARCH: 'packages:search',
  PACKAGES_NL_ASK: 'packages:nlAsk',
  PACKAGES_NL_CANCEL: 'packages:nlCancel',

  // Code Analysis
  ANALYSIS_DETECT_TOOLS: 'analysis:detectTools',
  ANALYSIS_RUN: 'analysis:run',
  ANALYSIS_CANCEL: 'analysis:cancel',
  ANALYSIS_PROGRESS: 'analysis:progress',
  ANALYSIS_LOAD_REPORTS: 'analysis:loadReports',
  ANALYSIS_DELETE_REPORT: 'analysis:deleteReport',
  ANALYSIS_CREATE_TICKETS: 'analysis:createTickets',
  ANALYSIS_INSTALL_TOOL: 'analysis:installTool',
  ANALYSIS_INSTALL_PROGRESS: 'analysis:installProgress',
} as const
