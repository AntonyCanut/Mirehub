export type AiProviderId = 'claude' | 'codex'

export interface AiProviderConfig {
  id: AiProviderId
  displayName: string
  cliCommand: string
  npmPackage: string
  configDir: string
  detectionColor: string
  interactiveArgs: string[]
  nonInteractiveArgs: string[]
  nlQueryArgs: string[]
  envVarsToUnset: string[]
  versionStripPattern: RegExp
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderConfig> = {
  claude: {
    id: 'claude',
    displayName: 'Claude',
    cliCommand: 'claude',
    npmPackage: '@anthropic-ai/claude-code',
    configDir: '.claude',
    detectionColor: '#7c3aed',
    interactiveArgs: ['--dangerously-skip-permissions'],
    nonInteractiveArgs: ['--dangerously-skip-permissions', '--print'],
    nlQueryArgs: ['-p', '--model', 'claude-haiku-4-5-20251001', '--output-format', 'json'],
    envVarsToUnset: ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'],
    versionStripPattern: /^Claude Code /,
  },
  codex: {
    id: 'codex',
    displayName: 'Codex',
    cliCommand: 'codex',
    npmPackage: '@openai/codex',
    configDir: '.codex',
    detectionColor: '#10a37f',
    interactiveArgs: ['--full-auto'],
    nonInteractiveArgs: ['exec', '--full-auto'],
    nlQueryArgs: ['exec', '--full-auto', '--json'],
    envVarsToUnset: [],
    versionStripPattern: /^codex\s+/i,
  },
}

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[]
