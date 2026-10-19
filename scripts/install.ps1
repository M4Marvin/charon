<#
.SYNOPSIS
  Installs Charon on Windows and starts it.

.DESCRIPTION
  Downloads a private Node.js runtime (unless Node 22+ is already installed)
  and the Charon release for this machine, verifies the SHA-256 checksum, and
  writes a "charon" command to the install folder. Nothing is installed
  system-wide and no administrator prompt is needed.

.EXAMPLE
  irm https://github.com/M4Marvin/charon/releases/latest/download/install.ps1 | iex

.EXAMPLE
  .\install.ps1 -Dir C:\Apps\Charon -Port 3001 -NoStart
#>
[CmdletBinding()]
param(
  [string]$Dir = "$env:LOCALAPPDATA\Charon",
  [int]$Port = 3000,
  [string]$Version = "latest",
  [switch]$NoStart,
  [switch]$NoOpen,
  [switch]$DryRun,
  [switch]$Uninstall,
  [switch]$Purge,
  [switch]$NoPath
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # Newer PowerShell versions negotiate TLS automatically.
}
$Repo = "M4Marvin/charon"
$MinNodeMajor = 22
$AppDir = Join-Path $Dir "app"
$BinDir = Join-Path $Dir "bin"
$DataDir = Join-Path $Dir "data"
$RuntimeDir = Join-Path $Dir "runtime"
$Shim = Join-Path $BinDir "charon.cmd"

function Say([string]$Text) { Write-Host $Text }
function Step([string]$Mark, [string]$Text) { Write-Host "  $Mark $Text" }
function Die([string]$Text) { Write-Host ""; Write-Host "  x $Text" -ForegroundColor Red; Write-Host ""; exit 1 }

function Get-PlatformTag {
  $arch = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
  switch ($arch.ToString()) {
    "X64" { return "windows-x64" }
    "Arm64" {
      Step "!!" "Windows on ARM: using the x64 build under emulation."
      return "windows-x64"
    }
    default { Die "Unsupported Windows architecture: $arch" }
  }
}

function Get-ReleaseUrl([string]$Asset) {
  if ($Version -eq "latest") {
    return "https://github.com/$Repo/releases/latest/download/$Asset"
  }
  return "https://github.com/$Repo/releases/download/$Version/$Asset"
}

function Get-Text([string]$Url) {
  return (Invoke-WebRequest -Uri $Url -UseBasicParsing).Content
}

function Save-File([string]$Url, [string]$Destination) {
  Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-NodeVersion([string]$NodePath) {
  try {
    $value = & $NodePath -p "const [a,b]=process.versions.node.split('.').map(Number); (a>22||(a===22&&b>=14))?'ok':'old'" 2>$null
    return $value -eq "ok"
  } catch {
    return $false
  }
}

function Find-OrInstallNode([string]$Tag) {
  $existing = Get-Command node -ErrorAction SilentlyContinue
  if ($existing) {
    if (Test-NodeVersion $existing.Source) {
      Step "OK" "Node.js $(& $existing.Source -v) found"
      return $existing.Source
    }
  }

  Step ".." "Node.js $MinNodeMajor+ not found; downloading a private copy"
  New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
  $shasumsPath = Join-Path $RuntimeDir "SHASUMS256.txt"
  Save-File "https://nodejs.org/dist/latest-v$MinNodeMajor.x/SHASUMS256.txt" $shasumsPath
  $lines = Get-Content $shasumsPath
  $arch = if ($Tag -like "*-arm64") { "arm64" } else { "x64" }
  $pattern = "node-v.*-win-$arch\.zip$"
  $line = $lines | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $line) { Die "Could not find a Node.js build for win-$arch." }
  $parts = $line -split "\s+", 2
  $expected = $parts[0].ToLowerInvariant()
  $file = $line.Substring($line.IndexOf("node-v")).Trim()
  $zip = Join-Path $RuntimeDir $file
  Step ".." "Downloading $file"
  Save-File "https://nodejs.org/dist/latest-v$MinNodeMajor.x/$file" $zip
  $actual = Get-Sha256 $zip
  if ($expected -ne $actual) { Die "Node.js checksum mismatch. Refusing to continue." }
  Expand-Archive -Path $zip -DestinationPath $RuntimeDir -Force
  Remove-Item $zip, $shasumsPath -Force
  $nodeDir = Get-ChildItem $RuntimeDir -Directory -Filter "node-v*-win-$arch" | Select-Object -First 1
  if (-not $nodeDir) { Die "Node.js did not extract as expected." }
  $nodeExe = Join-Path $nodeDir.FullName "node.exe"
  if (-not (Test-Path $nodeExe)) { Die "node.exe is missing from the downloaded runtime." }
  Step "OK" "Node.js $(& $nodeExe -v) installed in $RuntimeDir"
  return $nodeExe
}

function Write-Shim([string]$NodeExe) {
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $content = @"
@echo off
set "CHARON_HOME=$Dir"
set "CHARON_DATA_DIR=$DataDir"
set "PORT=$Port"
"$NodeExe" "$AppDir\bin\charon.mjs" %*
"@
  # Default encoding keeps non-ASCII install paths readable by cmd.exe.
  Set-Content -Path $Shim -Value $content -Encoding Default
  Step "OK" "Installed $Shim"
}

function Add-ToUserPath([string]$Entry) {
  $current = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not $current) { $current = "" }
  $parts = $current -split ";" | Where-Object { $_ -ne "" }
  if ($parts -notcontains $Entry) {
    $next = if ($current.Trim().Length -eq 0) { $Entry } else { "$current;$Entry" }
    [Environment]::SetEnvironmentVariable("Path", $next, "User")
    Step "OK" "Added $Entry to your user PATH (open a new terminal to use it)"
  }
  if (($env:Path -split ";") -notcontains $Entry) {
    $env:Path = "$env:Path;$Entry"
  }
}

function Invoke-Uninstall {
  $resolved = [System.IO.Path]::GetFullPath($Dir)
  $root = [System.IO.Path]::GetPathRoot($resolved)
  $profile = [System.IO.Path]::GetFullPath($env:USERPROFILE)
  if ($resolved -eq $root -or $resolved -eq $profile) {
    Die "Refusing to modify $resolved. Choose a Charon-specific directory."
  }
  $hasMarker = (Test-Path (Join-Path $AppDir "bin\charon.mjs")) -or
    (Test-Path (Join-Path $DataDir "instance.json")) -or
    (Test-Path $Shim)
  if (-not $hasMarker) {
    Die "No Charon installation found at $resolved. Refusing to delete anything."
  }
  if (Test-Path $Shim) { & $Shim stop 2>$null | Out-Null }
  if ($Purge) {
    Say "This deletes $Dir, including your chats and characters."
    $answer = Read-Host "Type delete to confirm"
    if ($answer -ne "delete") { Die "Cancelled. Nothing was deleted." }
    Remove-Item -Path $Dir -Recurse -Force
    Say "  Removed $Dir"
  } else {
    Remove-Item -Path $AppDir, $BinDir, $RuntimeDir -Recurse -Force -ErrorAction SilentlyContinue
    Say "  Removed the app. Your data is still in $DataDir"
  }
}

# --- main -----------------------------------------------------------------

$Tag = Get-PlatformTag
$Asset = "charon-$Tag.zip"

if ($DryRun) {
  Say "Charon installer (dry run)"
  Say "  platform  $Tag"
  Say "  home      $Dir"
  Say "  asset     $Asset"
  Say "  release   $(Get-ReleaseUrl $Asset)"
  Say "  port      $Port"
  exit 0
}

if ($Uninstall -or $Purge) {
  Invoke-Uninstall
  exit 0
}

Say ""
Say "Charon installer"
Say ""
Step ".." "Detecting your platform"
Step "OK" $Tag

New-Item -ItemType Directory -Force -Path $Dir, $BinDir, $DataDir | Out-Null
$nodeExe = Find-OrInstallNode $Tag

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("charon-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  Step ".." "Downloading Charon $Version"
  $archive = Join-Path $tmp $Asset
  Save-File (Get-ReleaseUrl $Asset) $archive
  $checksumPath = Join-Path $tmp "$Asset.sha256"
  try {
    Save-File (Get-ReleaseUrl "$Asset.sha256") $checksumPath
  } catch {
    Die "The release checksum is unavailable. Refusing to install an unverified download."
  }
  $expected = ((Get-Content $checksumPath -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
  if (-not $expected) { Die "The release checksum file is empty. Refusing to install." }
  $actual = Get-Sha256 $archive
  if ($expected -ne $actual) { Die "Charon checksum mismatch. Refusing to install." }
  Step "OK" "Download verified (sha256)"

  Step ".." "Extracting to $AppDir"
  $staging = "$AppDir.new"
  Remove-Item -Path $staging -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path $archive -DestinationPath $staging -Force
  foreach ($required in @("bin\charon.mjs", ".output\server\index.mjs", "drizzle")) {
    if (-not (Test-Path (Join-Path $staging $required))) {
      Remove-Item -Path $staging -Recurse -Force
      Die "The release is missing $required."
    }
  }
  # Stop the old server before swapping files; Windows cannot replace locked
  # native modules while the process is running.
  if (Test-Path $Shim) { & $Shim stop 2>$null | Out-Null; Start-Sleep -Milliseconds 600 }
  Remove-Item -Path "$AppDir.old" -Recurse -Force -ErrorAction SilentlyContinue
  if (Test-Path $AppDir) { Move-Item -Path $AppDir -Destination "$AppDir.old" }
  Move-Item -Path $staging -Destination $AppDir
  Remove-Item -Path "$AppDir.old" -Recurse -Force -ErrorAction SilentlyContinue
} finally {
  Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Shim $nodeExe
if (-not $NoPath) {
  Add-ToUserPath $BinDir
} else {
  Step "OK" "Skipped PATH edit (-NoPath). Run $Shim directly."
}

if ($NoStart) {
  Say ""
  Say "  Installed. Start it with: $Shim"
  exit 0
}

Say ""
Step ".." "Starting Charon"
if ($NoOpen) {
  & $Shim start --no-open
} else {
  & $Shim start
}
if ($LASTEXITCODE -ne 0) { Die "Charon did not start. Run: $Shim logs" }

Say ""
Say "  Charon is running at http://localhost:$Port"
Say ""
Say "  Next     Create your account, then follow the setup steps in the browser."
Say "  Data     $DataDir (copy this folder to back up)"
Say "  Stop     $Shim stop"
Say "  Update   $Shim update"
Say "  Help     $Shim --help"
Say ""
