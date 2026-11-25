# Zero-dependency installer for wowidea-skill (Windows PowerShell).
# Configures WOWIDEA_API_KEY safely and copies/links the skill into AI coding agents.
# Never echoes or logs WOWIDEA_API_KEY.

$ErrorActionPreference = "Stop"

$Repo = if ($env:WOWIDEA_SKILL_REPO) { $env:WOWIDEA_SKILL_REPO } else { "https://github.com/Salvatore0104/wowidea-skill.git" }
$Dest = if ($env:WOWIDEA_SKILL_HOME) { $env:WOWIDEA_SKILL_HOME } else { Join-Path $env:USERPROFILE ".wowidea-skill" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "需要 Node.js 18 或更新版本（請從 https://nodejs.org/ 安裝）。"
}

$Key = if ($env:WOWIDEA_API_KEY) { $env:WOWIDEA_API_KEY.Trim() } elseif ($env:EASYAI_API_KEY) { $env:EASYAI_API_KEY.Trim() } else { "" }
$KeyFile = Join-Path $env:USERPROFILE ".config\wowidea\api_key"
if (-not $Key -and (Test-Path $KeyFile)) {
  $Key = (Get-Content -Raw $KeyFile).Trim()
}
if (-not $Key) {
  throw "未提供 WOWIDEA_API_KEY。請先設定 `$env:WOWIDEA_API_KEY='sk-...' 後重試。"
}
$env:WOWIDEA_API_KEY = $Key

$LocalRoot = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { "" }
if ($LocalRoot -and (Test-Path (Join-Path $LocalRoot "skills\wowidea\SKILL.md"))) {
  if ($LocalRoot -ne $Dest) {
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Copy-Item -Recurse -Force (Join-Path $LocalRoot "skills") $Dest
    Copy-Item -Recurse -Force (Join-Path $LocalRoot "scripts") $Dest
  }
} else {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "未檢測到 git，請先安裝 git。"
  }
  if (Test-Path (Join-Path $Dest ".git")) {
    git -C $Dest remote set-url origin $Repo
    git -C $Dest fetch --depth 1 origin
    git -C $Dest checkout --detach --force FETCH_HEAD
  } else {
    if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
    git clone --depth 1 $Repo $Dest
  }
}

$CfgDir = Join-Path $env:USERPROFILE ".config\wowidea"
New-Item -ItemType Directory -Force -Path $CfgDir | Out-Null
Set-Content -NoNewline -Encoding UTF8 -Path $KeyFile -Value "$Key`n"
[Environment]::SetEnvironmentVariable("WOWIDEA_API_KEY", $Key, "User")
Write-Host "已將 WOWIDEA_API_KEY 寫入當前使用者環境變數與 ~/.config/wowidea/api_key。"

$SkillSrc = Join-Path $Dest "skills\wowidea"
$Targets = @(
  (Join-Path $env:USERPROFILE ".claude\skills"),
  (Join-Path $env:USERPROFILE ".cursor\skills"),
  (Join-Path $env:USERPROFILE ".codex\skills"),
  (Join-Path $env:USERPROFILE ".gemini\skills"),
  (Join-Path $env:USERPROFILE ".gemini\config\skills"),
  (Join-Path $env:USERPROFILE ".agents\skills")
)
foreach ($Parent in $Targets) {
  New-Item -ItemType Directory -Force -Path $Parent | Out-Null
  $TargetPath = Join-Path $Parent "wowidea"
  if (Test-Path $TargetPath) { Remove-Item -Recurse -Force $TargetPath }
  Copy-Item -Recurse -Force $SkillSrc $TargetPath
}
Write-Host "已安裝 wowidea 技能至 Claude Code / Cursor / Codex / Gemini / Antigravity。"

node (Join-Path $SkillSrc "scripts\wowidea.mjs") balance
