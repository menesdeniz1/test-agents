<#
.SYNOPSIS
Install or update this agent template in a project.

.DESCRIPTION
Copies .claude/ and the team rules into a target project without destroying
what is already there:

  - An existing CLAUDE.md is never overwritten. The team rules go into a
    delimited block that this script owns and rewrites in place on update;
    everything else in the file, including your Project context, is left
    alone.
  - An existing .claude/settings.json is never overwritten. The template's
    copy is written alongside as settings.json.from-template to merge.
  - An agent file that already exists is left alone unless -Force.

Writes .claude/TEMPLATE_VERSION so a project can say which template version
it is carrying.

This file is deliberately ASCII-only: Windows PowerShell 5.1 reads .ps1 as
ANSI when there is no BOM, so a stray em dash breaks the parser.

.EXAMPLE
.\install.ps1 -Target C:\code\my-project
#>
[CmdletBinding()]
param(
    [string]$Target = (Get-Location).Path,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$TemplateRoot = $PSScriptRoot
$Target = (Resolve-Path -LiteralPath $Target).Path

if ($Target -eq $TemplateRoot) {
    throw "Target is the template itself. Pass -Target <your project path>."
}

# Must match install.sh exactly, or the two would manage different blocks.
$BeginMarker = '<!-- agent-template:begin (managed block - rewritten on update) -->'
$EndMarker = '<!-- agent-template:end -->'

# --- version stamp -----------------------------------------------------
$version = 'unknown'
try {
    Push-Location $TemplateRoot
    $sha = git rev-parse --short HEAD
    if ($LASTEXITCODE -eq 0 -and $sha) { $version = $sha.Trim() }
} catch {
    # git missing or not a repo; 'unknown' is a fine answer
} finally {
    Pop-Location
}

# --- manifest ----------------------------------------------------------
# Records the hash of every file this script installed, so a later run can
# tell "unchanged since I installed it" (safe to update) from "the user
# edited this" (leave it alone). Without this, updates never propagate.
$manifestPath = Join-Path $Target '.claude\.template-manifest'
$manifest = @{}
if (Test-Path $manifestPath) {
    Get-Content $manifestPath | ForEach-Object {
        $parts = $_ -split '  ', 2
        if ($parts.Count -eq 2) { $manifest[$parts[1]] = $parts[0] }
    }
}
$newManifest = @{}

function Get-Sha([string]$p) { (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }

# Returns 'install', 'update', or 'keep' for one template file.
function Get-Action([string]$dst, [string]$key) {
    if (-not (Test-Path $dst)) { return 'install' }
    if ($Force) { return 'update' }
    if ($manifest.ContainsKey($key) -and $manifest[$key] -eq (Get-Sha $dst)) { return 'update' }
    return 'keep'
}

# --- agents ------------------------------------------------------------
$agentsDst = Join-Path $Target '.claude\agents'
New-Item -ItemType Directory -Force -Path $agentsDst | Out-Null

$installed = @()
$updated = @()
$kept = @()
Get-ChildItem (Join-Path $TemplateRoot '.claude\agents\*.md') | ForEach-Object {
    # Capture these before the switch: inside a switch block $_ is the switch
    # value, not the pipeline item.
    $name = $_.Name
    $src = $_.FullName
    $key = ".claude/agents/$name"
    $dst = Join-Path $agentsDst $name
    switch (Get-Action $dst $key) {
        'install' { Copy-Item $src $dst -Force; $installed += $name }
        'update'  { Copy-Item $src $dst -Force; $updated += $name }
        'keep'    { $kept += $name }
    }
    if (Test-Path $dst) { $newManifest[$key] = Get-Sha $dst }
}

# --- settings.json -----------------------------------------------------
$settingsSrc = Join-Path $TemplateRoot '.claude\settings.json'
$settingsDst = Join-Path $Target '.claude\settings.json'
$settingsKey = '.claude/settings.json'
switch (Get-Action $settingsDst $settingsKey) {
    'install' { Copy-Item $settingsSrc $settingsDst; $settingsNote = 'installed' }
    'update'  { Copy-Item $settingsSrc $settingsDst -Force; $settingsNote = 'updated (was unmodified since last install)' }
    'keep'    {
        Copy-Item $settingsSrc (Join-Path $Target '.claude\settings.json.from-template') -Force
        $settingsNote = 'kept yours; template copy at .claude/settings.json.from-template, merge by hand'
    }
}
if (Test-Path $settingsDst) { $newManifest[$settingsKey] = Get-Sha $settingsDst }

# --- CLAUDE.md ---------------------------------------------------------
# The Project context section is per-project, so it must live OUTSIDE the
# managed block or an update would wipe what you filled in.
$templateMd = Get-Content (Join-Path $TemplateRoot 'CLAUDE.md') -Raw
$splitAt = $templateMd.IndexOf('## Project context')
if ($splitAt -lt 0) {
    $rules = $templateMd.TrimEnd()
    $projectContext = ''
} else {
    $rules = $templateMd.Substring(0, $splitAt).TrimEnd()
    $projectContext = $templateMd.Substring($splitAt).TrimEnd()
}

$block = "$BeginMarker`n<!-- template version: $version -->`n$rules`n$EndMarker"
$claudeMd = Join-Path $Target 'CLAUDE.md'

if (-not (Test-Path $claudeMd)) {
    $body = $block
    if ($projectContext) { $body = "$block`n`n$projectContext" }
    Set-Content -LiteralPath $claudeMd -Value $body -Encoding utf8
    $mdNote = 'created CLAUDE.md'
} else {
    $existing = Get-Content $claudeMd -Raw
    $pattern = [regex]::Escape($BeginMarker) + '[\s\S]*?' + [regex]::Escape($EndMarker)
    if ([regex]::IsMatch($existing, $pattern)) {
        $mergedMd = [regex]::Replace($existing, $pattern, { param($m) $block })
        Set-Content -LiteralPath $claudeMd -Value $mergedMd -Encoding utf8
        $mdNote = 'updated the managed block in your existing CLAUDE.md'
    } else {
        $append = $block
        if ($projectContext -and ($existing -notmatch '(?m)^##\s+Project context')) {
            $append = "$block`n`n$projectContext"
        }
        Add-Content -LiteralPath $claudeMd -Value "`n`n$append" -Encoding utf8
        $mdNote = 'appended the managed block to your CLAUDE.md (nothing removed)'
    }
}

# --- version marker ----------------------------------------------------
$stamp = @(
    "version: $version",
    "installed: $(Get-Date -Format 'yyyy-MM-dd')",
    "source: $TemplateRoot",
    '',
    'Re-run install.ps1 from the template to update. The managed block in',
    'CLAUDE.md is rewritten in place; your Project context is not touched.'
) -join "`n"
Set-Content -LiteralPath (Join-Path $Target '.claude\TEMPLATE_VERSION') -Value $stamp -Encoding utf8

$lines = $newManifest.Keys | Sort-Object | ForEach-Object { "$($newManifest[$_])  $_" }
Set-Content -LiteralPath $manifestPath -Value ($lines -join "`n") -Encoding utf8

# --- report ------------------------------------------------------------
Write-Host ""
Write-Host "Installed agent template $version into $Target" -ForegroundColor Green
if ($installed.Count) { Write-Host "  agents installed: $($installed -join ', ')" }
if ($updated.Count)   { Write-Host "  agents updated:   $($updated -join ', ')" }
if ($kept.Count)      { Write-Host "  agents kept (locally modified, -Force to overwrite): $($kept -join ', ')" -ForegroundColor Yellow }
Write-Host "  settings: $settingsNote"
Write-Host "  CLAUDE.md: $mdNote"
Write-Host ""
Write-Host "Next: fill in the Project context section of CLAUDE.md (stack, test/lint/build commands)."
