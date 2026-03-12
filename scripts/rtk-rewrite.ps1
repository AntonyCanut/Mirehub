# RTK auto-rewrite hook for Claude Code PreToolUse:Bash (Windows)
# Transparently rewrites raw commands to their rtk equivalents.
# Outputs JSON with updatedInput to modify the command before execution.

# Guards: skip silently if rtk is not available
$rtkPath = Get-Command rtk -ErrorAction SilentlyContinue
if (-not $rtkPath) {
    exit 0
}

$ErrorActionPreference = 'Stop'

# Read JSON input from stdin
$rawInput = $input | Out-String
if ([string]::IsNullOrWhiteSpace($rawInput)) {
    exit 0
}

try {
    $inputObj = $rawInput | ConvertFrom-Json
} catch {
    exit 0
}

$cmd = $inputObj.tool_input.command
if ([string]::IsNullOrWhiteSpace($cmd)) {
    exit 0
}

$firstCmd = $cmd

# Skip if already using rtk
if ($firstCmd -match '^\s*(rtk\s|.*[/\\]rtk\s)') {
    exit 0
}

# Skip heredocs
if ($firstCmd -match '<<') {
    exit 0
}

# Strip leading env var assignments for pattern matching
# e.g., "TEST_SESSION_ID=2 npx vitest" -> match "npx vitest"
$envPrefix = ''
$matchCmd = $firstCmd
$cmdBody = $cmd

if ($firstCmd -match '^(([A-Za-z_][A-Za-z0-9_]*=[^ ]* +)+)') {
    $envPrefix = $Matches[1]
    $matchCmd = $firstCmd.Substring($envPrefix.Length)
    $cmdBody = $cmd.Substring($envPrefix.Length)
}

$rewritten = ''

# --- Git commands ---
if ($matchCmd -match '^git\s') {
    $gitSubCmd = $matchCmd -replace '^git\s+', ''
    $gitSubCmd = $gitSubCmd -replace '(-C|-c)\s+\S+\s*', ''
    $gitSubCmd = $gitSubCmd -replace '--[a-z-]+=\S+\s*', ''
    $gitSubCmd = $gitSubCmd -replace '--(no-pager|no-optional-locks|bare|literal-pathspecs)\s*', ''
    $gitSubCmd = $gitSubCmd.TrimStart()

    if ($gitSubCmd -match '^(status|diff|log|add|commit|push|pull|branch|fetch|stash|show)(\s|$)') {
        $rewritten = "${envPrefix}rtk $cmdBody"
    }
}
# --- GitHub CLI ---
elseif ($matchCmd -match '^gh\s+(pr|issue|run|api|release)(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^gh\s', 'rtk gh ')
}
# --- Cargo ---
elseif ($matchCmd -match '^cargo\s') {
    $cargoSubCmd = $matchCmd -replace '^cargo\s+(\+\S+\s+)?', ''
    if ($cargoSubCmd -match '^(test|build|clippy|check|install|fmt)(\s|$)') {
        $rewritten = "${envPrefix}rtk $cmdBody"
    }
}
# --- File operations ---
elseif ($matchCmd -match '^cat\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^cat\s', 'rtk read ')
}
elseif ($matchCmd -match '^(rg|grep)\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(rg|grep)\s', 'rtk grep ')
}
elseif ($matchCmd -match '^ls(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^ls', 'rtk ls')
}
elseif ($matchCmd -match '^tree(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^tree', 'rtk tree')
}
elseif ($matchCmd -match '^find\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^find\s', 'rtk find ')
}
elseif ($matchCmd -match '^diff\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^diff\s', 'rtk diff ')
}
elseif ($matchCmd -match '^head\s+') {
    if ($matchCmd -match '^head\s+-(\d+)\s+(.+)$') {
        $lines = $Matches[1]
        $file = $Matches[2]
        $rewritten = "${envPrefix}rtk read $file --max-lines $lines"
    }
    elseif ($matchCmd -match '^head\s+--lines=(\d+)\s+(.+)$') {
        $lines = $Matches[1]
        $file = $Matches[2]
        $rewritten = "${envPrefix}rtk read $file --max-lines $lines"
    }
}
# --- JS/TS tooling ---
elseif ($matchCmd -match '^(pnpm\s+)?(npx\s+)?vitest(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(pnpm\s+)?(npx\s+)?vitest(\s+run)?', 'rtk vitest run')
}
elseif ($matchCmd -match '^pnpm\s+test(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pnpm\s+test', 'rtk vitest run')
}
elseif ($matchCmd -match '^npm\s+test(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^npm\s+test', 'rtk npm test')
}
elseif ($matchCmd -match '^npm\s+run\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^npm\s+run\s', 'rtk npm ')
}
elseif ($matchCmd -match '^(npx\s+)?vue-tsc(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?vue-tsc', 'rtk tsc')
}
elseif ($matchCmd -match '^pnpm\s+tsc(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pnpm\s+tsc', 'rtk tsc')
}
elseif ($matchCmd -match '^(npx\s+)?tsc(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?tsc', 'rtk tsc')
}
elseif ($matchCmd -match '^pnpm\s+lint(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pnpm\s+lint', 'rtk lint')
}
elseif ($matchCmd -match '^(npx\s+)?eslint(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?eslint', 'rtk lint')
}
elseif ($matchCmd -match '^(npx\s+)?prettier(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?prettier', 'rtk prettier')
}
elseif ($matchCmd -match '^(npx\s+)?playwright(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?playwright', 'rtk playwright')
}
elseif ($matchCmd -match '^pnpm\s+playwright(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pnpm\s+playwright', 'rtk playwright')
}
elseif ($matchCmd -match '^(npx\s+)?prisma(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^(npx\s+)?prisma', 'rtk prisma')
}
# --- Containers ---
elseif ($matchCmd -match '^docker\s') {
    if ($matchCmd -match '^docker\s+compose(\s|$)') {
        $rewritten = $envPrefix + ($cmdBody -replace '^docker\s', 'rtk docker ')
    }
    else {
        $dockerSubCmd = $matchCmd -replace '^docker\s+', ''
        $dockerSubCmd = $dockerSubCmd -replace '(-H|--context|--config)\s+\S+\s*', ''
        $dockerSubCmd = $dockerSubCmd -replace '--[a-z-]+=\S+\s*', ''
        $dockerSubCmd = $dockerSubCmd.TrimStart()
        if ($dockerSubCmd -match '^(ps|images|logs|run|build|exec)(\s|$)') {
            $rewritten = $envPrefix + ($cmdBody -replace '^docker\s', 'rtk docker ')
        }
    }
}
elseif ($matchCmd -match '^kubectl\s') {
    $kubeSubCmd = $matchCmd -replace '^kubectl\s+', ''
    $kubeSubCmd = $kubeSubCmd -replace '(--context|--kubeconfig|--namespace|-n)\s+\S+\s*', ''
    $kubeSubCmd = $kubeSubCmd -replace '--[a-z-]+=\S+\s*', ''
    $kubeSubCmd = $kubeSubCmd.TrimStart()
    if ($kubeSubCmd -match '^(get|logs|describe|apply)(\s|$)') {
        $rewritten = $envPrefix + ($cmdBody -replace '^kubectl\s', 'rtk kubectl ')
    }
}
# --- Network ---
elseif ($matchCmd -match '^curl\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^curl\s', 'rtk curl ')
}
elseif ($matchCmd -match '^wget\s+') {
    $rewritten = $envPrefix + ($cmdBody -replace '^wget\s', 'rtk wget ')
}
# --- pnpm package management ---
elseif ($matchCmd -match '^pnpm\s+(list|ls|outdated)(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pnpm\s', 'rtk pnpm ')
}
# --- Python tooling ---
elseif ($matchCmd -match '^pytest(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pytest', 'rtk pytest')
}
elseif ($matchCmd -match '^python\s+-m\s+pytest(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^python\s+-m\s+pytest', 'rtk pytest')
}
elseif ($matchCmd -match '^ruff\s+(check|format)(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^ruff\s', 'rtk ruff ')
}
elseif ($matchCmd -match '^pip\s+(list|outdated|install|show)(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^pip\s', 'rtk pip ')
}
elseif ($matchCmd -match '^uv\s+pip\s+(list|outdated|install|show)(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^uv\s+pip\s', 'rtk pip ')
}
# --- Go tooling ---
elseif ($matchCmd -match '^go\s+test(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^go\s+test', 'rtk go test')
}
elseif ($matchCmd -match '^go\s+build(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^go\s+build', 'rtk go build')
}
elseif ($matchCmd -match '^go\s+vet(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^go\s+vet', 'rtk go vet')
}
elseif ($matchCmd -match '^golangci-lint(\s|$)') {
    $rewritten = $envPrefix + ($cmdBody -replace '^golangci-lint', 'rtk golangci-lint')
}

# If no rewrite needed, approve as-is
if ([string]::IsNullOrEmpty($rewritten)) {
    exit 0
}

# Build updated tool_input: re-serialize original, replace command, re-parse
$originalInputJson = $inputObj.tool_input | ConvertTo-Json -Depth 10 -Compress
$updatedInputJson = $originalInputJson | ConvertFrom-Json
$updatedInputJson.command = $rewritten

# Output the rewrite instruction as JSON
$output = [ordered]@{
    hookSpecificOutput = [ordered]@{
        hookEventName           = 'PreToolUse'
        permissionDecision      = 'allow'
        permissionDecisionReason = 'RTK auto-rewrite'
        updatedInput            = $updatedInputJson
    }
}

$output | ConvertTo-Json -Depth 10 -Compress
