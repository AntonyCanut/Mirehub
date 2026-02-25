export const DEFAULT_SETTINGS = {
    theme: 'dark',
    locale: 'fr',
    defaultShell: process.env.SHELL || '/bin/zsh',
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollbackLines: 10000,
    claudeDetectionColor: '#7c3aed',
    autoClauderEnabled: false,
    notificationSound: true,
    checkUpdatesOnLaunch: true,
    autoCloseCompletedTerminals: false,
};
export const MAX_PANES_PER_TAB = 4;
export const MAX_AGENTS_PER_PROJECT = 4;
export const DEFAULT_LOOP_DELAY_MS = 5000;
export const MAX_LOOP_ERRORS_BEFORE_STOP = 3;
//# sourceMappingURL=defaults.js.map