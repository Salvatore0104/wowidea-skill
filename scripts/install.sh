#!/usr/bin/env bash
# Zero-dependency installer for wowidea-skill (macOS & Linux).
# Configures WOWIDEA_API_KEY safely and links the skill into AI coding agents.
# Never echoes or logs WOWIDEA_API_KEY.

{
set +x
set -euo pipefail

REPO="${WOWIDEA_SKILL_REPO:-https://github.com/Salvatore0104/wowidea-skill.git}"
DEST="${WOWIDEA_SKILL_HOME:-$HOME/.wowidea-skill}"
SCRIPT_SOURCE_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

die() {
  printf 'Error: %s\n' "$1" >&2
  exit "${2:-2}"
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "需要 Node.js 18 或更新版本（請從 https://nodejs.org/ 安裝）。" 2
  fi
  if ! node -e 'const maj=Number(process.versions.node.split(".")[0]); process.exit(maj>=18?0:1)' </dev/null; then
    die "當前 Node.js 版本過低（$(node -v)），需要 Node.js 18+。" 2
  fi
}

tty_ok() {
  { : >/dev/tty; } 2>/dev/null
}

read_api_key() {
  KEY="${WOWIDEA_API_KEY:-${EASYAI_API_KEY:-}}"
  if [[ -z "$KEY" && -f "$HOME/.config/wowidea/api_key" ]]; then
    KEY="$(tr -d '\r\n' < "$HOME/.config/wowidea/api_key")"
  fi
  if [[ -z "$KEY" ]] && tty_ok; then
    printf '請輸入 WOWIDEA_API_KEY（輸入不回顯）：' >/dev/tty
    IFS= read -r -s KEY </dev/tty || true
    printf '\n' >/dev/tty
  fi
  if [[ -z "$KEY" ]]; then
    die "未提供 WOWIDEA_API_KEY。請在命令前加上 WOWIDEA_API_KEY='sk-...' 後重試。" 3
  fi
  case "$KEY" in
    *$'\n'*|*$'\r'*) die "WOWIDEA_API_KEY 不能包含換行。" 2 ;;
  esac
  export WOWIDEA_API_KEY="$KEY"
}

sync_skill_files() {
  if [[ -n "$SCRIPT_SOURCE_DIR" && -f "$SCRIPT_SOURCE_DIR/skills/wowidea/SKILL.md" ]]; then
    if [[ "$SCRIPT_SOURCE_DIR" != "$DEST" ]]; then
      mkdir -p "$DEST"
      cp -R "$SCRIPT_SOURCE_DIR/skills" "$SCRIPT_SOURCE_DIR/scripts" "$DEST/"
      [[ -f "$SCRIPT_SOURCE_DIR/README.md" ]] && cp "$SCRIPT_SOURCE_DIR/README.md" "$DEST/" || true
      [[ -f "$SCRIPT_SOURCE_DIR/INSTALL.md" ]] && cp "$SCRIPT_SOURCE_DIR/INSTALL.md" "$DEST/" || true
    fi
    chmod +x "$DEST/skills/wowidea/scripts/wowidea.mjs"
    printf '已同步技能檔案至 %s\n' "$DEST"
    return 0
  fi

  command -v git >/dev/null 2>&1 || die "未檢測到 git，請先安裝 git。" 2
  export GIT_TERMINAL_PROMPT=0
  if [[ -d "$DEST/.git" ]]; then
    git -C "$DEST" remote set-url origin "$REPO" </dev/null
    git -C "$DEST" fetch --depth 1 origin </dev/null
    git -C "$DEST" checkout --detach --force FETCH_HEAD </dev/null
  else
    rm -rf "$DEST"
    git clone --depth 1 "$REPO" "$DEST" </dev/null
  fi
  chmod +x "$DEST/skills/wowidea/scripts/wowidea.mjs"
  printf '已下載技能倉庫至 %s\n' "$DEST"
}

persist_api_key() {
  node - <<'EOF'
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const key = (process.env.WOWIDEA_API_KEY || "").trim();
if (!key || /[\r\n\0]/.test(key)) process.exit(2);

const home = os.homedir();
const cfgDir = path.join(home, ".config", "wowidea");
fs.mkdirSync(cfgDir, { recursive: true, mode: 0o700 });
const keyPath = path.join(cfgDir, "api_key");
fs.writeFileSync(keyPath, key + "\n", { mode: 0o600 });
fs.chmodSync(keyPath, 0o600);

const start = "# >>> wowidea-skill >>>";
const end = "# <<< wowidea-skill <<<";
const quoted = "'" + key.replace(/'/g, "'\\''") + "'";
const block = `${start}\nexport WOWIDEA_API_KEY=${quoted}\n${end}`;
const blockRe = new RegExp(`${start}[\\s\\S]*?${end}\\n?`, "g");

const rcFiles = [".zshenv", ".zshrc", ".bashrc"];
if (fs.existsSync(path.join(home, ".bash_profile"))) rcFiles.push(".bash_profile");

for (const name of rcFiles) {
  const file = path.join(home, name);
  try {
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) continue;
    let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (blockRe.test(text)) {
      text = text.replace(blockRe, block + "\n");
    } else {
      if (text.length > 0 && !text.endsWith("\n")) text += "\n";
      text += (text.length > 0 ? "\n" : "") + block + "\n";
    }
    fs.writeFileSync(file, text, { mode: 0o600 });
  } catch {
    // ~/.config/wowidea/api_key remains authoritative fallback
  }
}
console.log("已將 WOWIDEA_API_KEY 安全寫入本機環境與 ~/.config/wowidea/api_key (權限 600)。");
EOF
}

link_agent_skills() {
  local src="$DEST/skills/wowidea"
  local targets=(
    "$HOME/.claude/skills"
    "$HOME/.cursor/skills"
    "$HOME/.codex/skills"
    "$HOME/.gemini/skills"
    "$HOME/.gemini/config/skills"
    "$HOME/.agents/skills"
  )
  for parent in "${targets[@]}"; do
    mkdir -p "$parent"
    rm -rf "$parent/wowidea"
    ln -s "$src" "$parent/wowidea"
  done

  mkdir -p "$HOME/.local/bin"
  ln -sfn "$src/scripts/wowidea.mjs" "$HOME/.local/bin/wowidea-api"
  printf '已掛載 wowidea 技能至 Claude Code / Cursor / Codex / Gemini / Antigravity。\n'
}

verify_connection() {
  printf '正在驗證 API 連通性與帳戶餘額...\n'
  if node "$DEST/skills/wowidea/scripts/wowidea.mjs" balance </dev/null; then
    printf '安裝與驗證全部完成！AI 現在可以直接調用 Wowidea 生成圖片、視頻與語音。\n'
  else
    printf '技能已安裝，但餘額校驗未通過，請前往 https://wowidea.top/user/api-key 檢查 Key 是否有效。\n' >&2
  fi
}

require_node
read_api_key
sync_skill_files
persist_api_key
link_agent_skills
verify_connection
}
