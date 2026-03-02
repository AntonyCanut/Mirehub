import type { ChildProcess } from 'child_process'
import type { PackageInfo, PackageManagerType, PkgNlMessage } from '../../../shared/types'
import type { AiProviderId } from '../../../shared/types/ai-provider'
import { callAiCli } from '../ai-cli'

/** Active NL query process for packages (single query at a time) */
const activeProcesses = new Map<string, ChildProcess>()

/**
 * Build a packages context string listing all packages with their version status.
 */
function buildPackagesContext(packages: PackageInfo[]): string {
  if (packages.length === 0) return 'No packages found in this project.'

  const lines = packages.map((pkg) => {
    const status = pkg.updateAvailable
      ? `${pkg.currentVersion} -> ${pkg.latestVersion} [UPDATE_AVAILABLE]`
      : `${pkg.currentVersion} [UP_TO_DATE]`

    const deprecation = pkg.isDeprecated
      ? ` [DEPRECATED${pkg.deprecationMessage ? `: ${pkg.deprecationMessage}` : ''}]`
      : ''

    const type = pkg.type === 'devDependency' ? ' (dev)' : ''

    return `  - ${pkg.name}: ${status}${deprecation}${type}`
  })

  const totalCount = packages.length
  const outdatedCount = packages.filter((p) => p.updateAvailable).length
  const deprecatedCount = packages.filter((p) => p.isDeprecated).length

  const summary = `Total: ${totalCount} packages, ${outdatedCount} with updates available, ${deprecatedCount} deprecated`

  return `${summary}\n\nPackages:\n${lines.join('\n')}`
}

/**
 * Format conversation history for the prompt.
 */
function formatHistory(history: PkgNlMessage[]): string {
  if (history.length === 0) return ''

  const lines = history.map((entry) => {
    if (entry.role === 'user') {
      return `User: ${entry.content}`
    }
    return `Assistant: ${entry.content}`
  })

  return `\nCONVERSATION HISTORY:\n${lines.join('\n')}\n`
}

/**
 * Ask a natural language question about the project's packages.
 * Uses Claude CLI (Haiku model) to generate a conversational answer
 * and optionally suggest package update actions.
 */
export async function askPackageQuestion(
  projectPath: string,
  manager: PackageManagerType,
  question: string,
  history: PkgNlMessage[],
  packages: PackageInfo[],
  provider: AiProviderId = 'claude',
): Promise<{ answer: string; action?: { type: 'update'; packages: string[] } }> {
  const packagesContext = buildPackagesContext(packages)
  const historyBlock = formatHistory(history)

  const systemPrompt = `You are a package management expert. You help developers understand and manage their project dependencies.

PROJECT: ${projectPath}
PACKAGE MANAGER: ${manager}

INSTALLED PACKAGES:
${packagesContext}
${historyBlock}
RULES:
1. Answer questions about these packages: versions, update status, deprecations, dependencies.
2. You can suggest safe updates (patch/minor version bumps without known breaking changes).
3. When suggesting updates, include ONLY packages that actually have updates available (marked [UPDATE_AVAILABLE]).
4. Respond in JSON format: { "answer": "your answer here", "action": { "type": "update", "packages": ["pkg1", "pkg2"] } }
5. The "action" field is OPTIONAL. Only include it when the user explicitly asks to update packages or when you recommend specific updates.
6. Always respond in French.
7. Output ONLY the JSON object, no markdown, no code blocks, no extra text.
8. Be conversational and helpful. Use actual package names and versions from the list above.
9. If the user asks about a package not in the list, say so clearly.

USER QUESTION: ${question}`

  let rawOutput: string
  try {
    rawOutput = await callAiCli(provider, systemPrompt, 'packages', activeProcesses)
  } catch (err) {
    const msg = String(err)
    if (msg.includes('cancelled')) {
      return { answer: 'Requete annulee' }
    }
    throw new Error(`Claude error: ${msg}`)
  }

  // Parse JSON response
  try {
    let cleaned = rawOutput.trim()
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
    else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
    cleaned = cleaned.trim()

    const parsed = JSON.parse(cleaned)

    const result: { answer: string; action?: { type: 'update'; packages: string[] } } = {
      answer: typeof parsed.answer === 'string' ? parsed.answer : rawOutput.trim(),
    }

    // Validate action if present
    if (
      parsed.action &&
      parsed.action.type === 'update' &&
      Array.isArray(parsed.action.packages) &&
      parsed.action.packages.length > 0
    ) {
      result.action = {
        type: 'update',
        packages: parsed.action.packages.filter((p: unknown) => typeof p === 'string'),
      }
    }

    return result
  } catch {
    // Fallback: treat raw output as the answer
    return { answer: rawOutput.trim() }
  }
}

/**
 * Cancel an active package NL query.
 */
export function cancelPackageQuery(): boolean {
  const proc = activeProcesses.get('packages')
  if (proc) {
    proc.kill('SIGTERM')
    activeProcesses.delete('packages')
    return true
  }
  return false
}

