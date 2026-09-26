<#
.SYNOPSIS
  Compact, incremental project sync report - for pasting into a fresh LLM chat.

.USAGE
  .\sync.ps1          # default: only dumps files changed since the LAST time you ran this
  .\sync.ps1 -Full     # full snapshot: dumps every tracked source file (use for a brand-new chat)

  First run ever (no marker file yet) always behaves like -Full automatically.

.NOTES
  Writes to sync-report.md - attach/paste that file, not console output.
  Add ".last-sync-commit" to your .gitignore - it's just a bookmark, not project state.
#>

param(
    [switch]$Full
)

$ErrorActionPreference = 'SilentlyContinue'

$OutFile      = 'sync-report.md'
$MarkerFile   = '.last-sync-commit'
$excludedDirs = @('node_modules','target','.git','.next','dist','build','gen','schemas','capabilities')
$extensions   = @('.ts','.tsx','.rs','.sql','.css')
$maxLines     = 400   # files bigger than this get listed, not embedded - keeps the report pasteable

function Test-Excluded($path) {
    foreach ($d in $excludedDirs) {
        if ($path -like "*\$d\*") { return $true }
    }
    return $false
}

$sb = New-Object System.Text.StringBuilder
function Add-Line($line = '') { [void]$sb.AppendLine($line) }
function Add-Fenced($lang, $content) {
    Add-Line ('```' + $lang)
    Add-Line $content.TrimEnd()
    Add-Line '```'
}

Add-Line "# Sync Report - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Add-Line ""
Add-Line "**Path:** $(Get-Location)"

# --- Git state ---
$branch = git branch --show-current
$lastCommit = git rev-parse HEAD
$hasGitHistory = -not [string]::IsNullOrWhiteSpace($lastCommit)

Add-Line "**Branch:** $branch"
Add-Line ""
Add-Line "## Git status"
Add-Fenced '' ((git status --short | Out-String))
Add-Line ""
Add-Line "## Recent commits"
Add-Fenced '' ((git log --oneline -5 | Out-String))

# --- Tree (always cheap, always included) ---
Add-Line ""
Add-Line "## File tree"
$treeLines = tree /F /A | Where-Object { $_ -notmatch ($excludedDirs -join '|') }
Add-Fenced '' ($treeLines -join "`n")

# --- Decide: full dump, or just what changed since last marker? ---
$useFull = $Full -or -not $hasGitHistory -or -not (Test-Path $MarkerFile)

if ($useFull) {
    $targetFiles = Get-ChildItem -Recurse -File | Where-Object {
        $extensions -contains $_.Extension.ToLower() -and -not (Test-Excluded $_.FullName)
    }
    Add-Line ""
    Add-Line "## Source - full snapshot ($($targetFiles.Count) files)"
} else {
    $lastMarker = (Get-Content $MarkerFile -Raw).Trim()
    $changedPaths = git diff --name-only $lastMarker HEAD
    $targetFiles = $changedPaths | ForEach-Object {
        $full = Join-Path (Get-Location) $_
        if ((Test-Path $full) -and
            ($extensions -contains ([IO.Path]::GetExtension($full)).ToLower()) -and
            -not (Test-Excluded $full)) {
            Get-Item $full
        }
    }
    Add-Line ""
    Add-Line "## Source - changed since last sync ($($lastMarker.Substring(0,7)))"
    if (-not $targetFiles) { Add-Line "*(no source changes since last sync)*" }
}

foreach ($file in $targetFiles) {
    $rel = $file.FullName.Substring((Get-Location).Path.Length + 1)
    $content = Get-Content $file.FullName
    if ($content.Count -gt $maxLines) {
        Add-Line ""
        Add-Line "### $rel ($($content.Count) lines - skipped, too large to embed)"
        continue
    }
    Add-Line ""
    Add-Line "### $rel"
    Add-Fenced $file.Extension.TrimStart('.') ($content | Out-String)
}

# --- Config files: always full, always small, always high-signal ---
Add-Line ""
Add-Line "## Config"
foreach ($cfg in @('package.json', 'src-tauri/Cargo.toml')) {
    if (Test-Path $cfg) {
        Add-Line ""
        Add-Line "### $cfg"
        Add-Fenced '' ((Get-Content $cfg | Out-String))
    }
}

$report = $sb.ToString()
Set-Content -Path $OutFile -Value $report -Encoding utf8
if ($hasGitHistory) { Set-Content -Path $MarkerFile -Value $lastCommit }

$sizeKb = [math]::Round(((Get-Item $OutFile).Length / 1KB), 1)
Write-Host "Wrote $OutFile ($sizeKb KB)."
if ($sizeKb -gt 60) {
    Write-Host "That's fairly large to paste directly - consider attaching the file instead of pasting inline."
}