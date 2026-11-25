# AI 助手安裝指南（Agent Install Instructions）

當使用者對你說「幫我安裝 `wowidea-skill`，我的 Key 是 `sk-...`」時，請嚴格按以下步驟無交互執行。

## 安全鐵律（必須遵守）

1. **禁止回顯密鑰**：絕對不要 `echo`、`printf`、`printenv` 或在回覆訊息中印出使用者的 `sk-...` 明文。
2. **禁止寫入專案倉庫**：不要把密鑰寫進當前工作區的 `.env`、`README.md` 或任何 Git 追蹤檔案。安裝腳本會自動將密鑰以 `600` 權限存入使用者主目錄 `~/.config/wowidea/api_key` 與個人 Shell 啟動檔（`~/.zshenv`、`~/.zshrc`、`~/.bashrc`）。
3. **零編譯、零 `sudo`**：本專案為純技能與零依賴腳本，不需要 `npm install`、不需要 `npm build`、禁止使用 `sudo`。

---

## 步驟 1：檢查 Node.js（需 18+）

macOS / Linux：
```bash
node -v
```
若未安裝 Node.js 或主版本低於 18，請停下來提示使用者從 https://nodejs.org/ 安裝，不要使用 `sudo` 代裝。

---

## 步驟 2：執行一鍵安裝與環境配置

將下方單引號內的佔位符替換為使用者訊息中提供的真實 Key（不要印出該變數），直接執行：

### macOS / Linux（倉庫尚未在本地時）
```bash
curl -fsSL https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.sh | WOWIDEA_API_KEY='使用者提供的Key' bash
```
*(若分支為 `master` 返回 404，改用 `https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/master/scripts/install.sh`，或先 `git clone --depth 1 https://github.com/Salvatore0104/wowidea-skill.git ~/.wowidea-skill` 再執行 `WOWIDEA_API_KEY='使用者提供的Key' bash ~/.wowidea-skill/scripts/install.sh </dev/null`)*

### macOS / Linux（當前已在倉庫目錄內時）
```bash
WOWIDEA_API_KEY='使用者提供的Key' bash ./scripts/install.sh </dev/null
```

### Windows PowerShell
```powershell
$env:WOWIDEA_API_KEY = '使用者提供的Key'
irm https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.ps1 | iex
```
*(若已在本地倉庫目錄內：`& "$PWD\scripts\install.ps1"`)*

---

## 步驟 3：確認安裝結果並回覆使用者

安裝腳本會自動完成三件事：
1. 將倉庫同步至 `~/.wowidea-skill`。
2. 將 `WOWIDEA_API_KEY` 寫入 `~/.config/wowidea/api_key`（權限 `600`）及 Shell 環境變數。
3. 將 `skills/wowidea` 自動掛載到 `~/.claude/skills/wowidea`、`~/.cursor/skills/wowidea`、`~/.codex/skills/wowidea`、`~/.gemini/skills/wowidea`、`~/.gemini/config/skills/wowidea` 與 `~/.agents/skills/wowidea`。
4. 調用 `GET /api/v1/balance` 驗證連通性與餘額。

最後向使用者簡短匯報：
- 技能已掛載完成。
- 帳戶餘額驗證是否通過（只報餘額數字，**不要複述 Key**）。
- 現在可以直接在對話中要求生圖、改圖、生視頻或語音配音。
