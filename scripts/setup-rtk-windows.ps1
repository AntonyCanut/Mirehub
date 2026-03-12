# RTK Windows Setup Script
# Installs the rtk-rewrite hook for Claude Code on Windows
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-rtk-windows.ps1

$ErrorActionPreference = 'Stop'

Write-Host "=== RTK Windows Setup ===" -ForegroundColor Cyan

# Step 1: Check if rtk is installed
$rtkCmd = Get-Command rtk -ErrorAction SilentlyContinue
if (-not $rtkCmd) {
    Write-Host ""
    Write-Host "[ERROR] rtk binary not found in PATH." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install rtk first:" -ForegroundColor Yellow
    Write-Host "  Option 1 (cargo): cargo install --git https://github.com/rtk-ai/rtk"
    Write-Host "  Option 2 (manual): Download rtk-x86_64-pc-windows-msvc.zip from GitHub releases"
    Write-Host "                     and add the extracted binary to your PATH."
    Write-Host ""
    Write-Host "After installing, verify with: rtk gain" -ForegroundColor Yellow
    exit 1
}

# Step 2: Verify it is the correct rtk (Token Killer, not Type Kit)
Write-Host ""
Write-Host "Checking rtk version..." -ForegroundColor Gray
$version = & rtk --version 2>&1
Write-Host "  Found: $version" -ForegroundColor Green

try {
    $gainOutput = & rtk gain 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "rtk gain failed"
    }
    Write-Host "  rtk gain: OK (correct RTK - Token Killer)" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "[WARNING] 'rtk gain' failed. You may have the wrong rtk (Rust Type Kit)." -ForegroundColor Yellow
    Write-Host "  Uninstall with: cargo uninstall rtk" -ForegroundColor Yellow
    Write-Host "  Then reinstall: cargo install --git https://github.com/rtk-ai/rtk" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y') {
        exit 1
    }
}

# Step 3: Create hooks directory
$claudeDir = Join-Path $env:USERPROFILE '.claude'
$hooksDir = Join-Path $claudeDir 'hooks'

if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    Write-Host ""
    Write-Host "  Created: $hooksDir" -ForegroundColor Green
}

# Step 4: Copy the PowerShell hook script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceHook = Join-Path $scriptDir 'rtk-rewrite.ps1'
$destHook = Join-Path $hooksDir 'rtk-rewrite.ps1'

if (-not (Test-Path $sourceHook)) {
    Write-Host "[ERROR] rtk-rewrite.ps1 not found at: $sourceHook" -ForegroundColor Red
    exit 1
}

Copy-Item -Path $sourceHook -Destination $destHook -Force
Write-Host ""
Write-Host "  Hook installed: $destHook" -ForegroundColor Green

# Step 5: Patch settings.json
$settingsPath = Join-Path $claudeDir 'settings.json'
$hookCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$destHook`""

$rtkHookEntry = @{
    type    = 'command'
    command = $hookCommand
}

if (Test-Path $settingsPath) {
    # Backup existing settings
    $backupPath = "$settingsPath.bak"
    Copy-Item -Path $settingsPath -Destination $backupPath -Force
    Write-Host "  Backup created: $backupPath" -ForegroundColor Green

    $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json

    # Ensure hooks.PreToolUse exists
    if (-not $settings.hooks) {
        $settings | Add-Member -NotePropertyName 'hooks' -NotePropertyValue @{} -Force
    }
    if (-not $settings.hooks.PreToolUse) {
        $settings.hooks | Add-Member -NotePropertyName 'PreToolUse' -NotePropertyValue @() -Force
    }

    # Check if RTK hook already registered
    $preToolUse = @($settings.hooks.PreToolUse)
    $rtkExists = $false

    foreach ($entry in $preToolUse) {
        if ($entry.matcher -eq 'Bash') {
            $hooks = @($entry.hooks)
            foreach ($hook in $hooks) {
                if ($hook.command -like '*rtk-rewrite*') {
                    $rtkExists = $true
                    # Update the command to PowerShell version
                    $hook.command = $hookCommand
                    Write-Host "  Updated existing RTK hook entry in settings.json" -ForegroundColor Green
                    break
                }
            }
            if ($rtkExists) { break }
        }
    }

    if (-not $rtkExists) {
        # Add new Bash matcher with RTK hook
        $newEntry = @{
            matcher = 'Bash'
            hooks   = @($rtkHookEntry)
        }
        $preToolUse += $newEntry
        $settings.hooks.PreToolUse = $preToolUse
        Write-Host "  Added RTK hook entry to settings.json" -ForegroundColor Green
    }

    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
} else {
    # Create new settings.json
    $settings = @{
        hooks = @{
            PreToolUse = @(
                @{
                    matcher = 'Bash'
                    hooks   = @($rtkHookEntry)
                }
            )
        }
    }
    $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
    Write-Host "  Created: $settingsPath" -ForegroundColor Green
}

# Step 6: Create/update RTK.md
$rtkMdPath = Join-Path $claudeDir 'RTK.md'
$rtkMdContent = @"
# RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations)

## Meta Commands (always use rtk directly)

``````bash
rtk gain              # Show token savings analytics
rtk gain --history    # Show command usage history with savings
rtk discover          # Analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # Execute raw command without filtering (for debugging)
``````

## Hook-Based Usage

All other commands are automatically rewritten by the Claude Code hook.
Example: ``git status`` -> ``rtk git status`` (transparent, 0 tokens overhead)
"@

Set-Content -Path $rtkMdPath -Value $rtkMdContent -Encoding UTF8
Write-Host "  Created/updated: $rtkMdPath" -ForegroundColor Green

# Step 7: Update CLAUDE.md to reference RTK.md
$claudeMdPath = Join-Path $claudeDir 'CLAUDE.md'
if (Test-Path $claudeMdPath) {
    $claudeMdContent = Get-Content $claudeMdPath -Raw
    if ($claudeMdContent -notmatch '@RTK\.md') {
        $claudeMdContent = "@RTK.md`n`n$claudeMdContent"
        Set-Content -Path $claudeMdPath -Value $claudeMdContent -Encoding UTF8
        Write-Host "  Added @RTK.md reference to CLAUDE.md" -ForegroundColor Green
    } else {
        Write-Host "  @RTK.md reference already in CLAUDE.md" -ForegroundColor Gray
    }
} else {
    Set-Content -Path $claudeMdPath -Value "@RTK.md`n" -Encoding UTF8
    Write-Host "  Created CLAUDE.md with @RTK.md reference" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "RTK hook is now installed for Claude Code on Windows." -ForegroundColor Green
Write-Host "Restart Claude Code to activate the hook." -ForegroundColor Yellow
Write-Host ""
Write-Host "Verify with:" -ForegroundColor Gray
Write-Host "  rtk --version"
Write-Host "  rtk gain"
Write-Host ""
