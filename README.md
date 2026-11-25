# wowidea-skill

讓沒有原生生圖、生視頻、配音能力的 AI 助手（Claude Code、Cursor、Codex、Gemini CLI、Antigravity 等）直接調用 [wowidea.top](https://wowidea.top) 上的多模態大模型。

**純技能說明書 + 單檔案零依賴請求腳本**：無需 `npm install`、無需編譯打包、不裝任何原生擴展，2 秒裝完即用。

---

## 一句話讓 AI 幫你裝（最推薦）

先在 [wowidea.top/user/api-key](https://wowidea.top/user/api-key) 建立一把 API Key，然後把下面這段話貼給你的 AI 助手：

```text
幫我安裝 wowidea-skill（https://github.com/Salvatore0104/wowidea-skill），按倉庫裡的 INSTALL.md 操作，我的 Key 是 sk-你的Key
```

AI 會自動：
1. 把 `WOWIDEA_API_KEY` 安全寫入你電腦本機環境（`~/.config/wowidea/api_key` 及 `~/.zshenv` / `~/.zshrc`，權限 `600`，不回顯、不進代碼庫）。
2. 把技能掛載到 Claude Code、Cursor、Codex、Gemini、Antigravity 的全域技能目錄。
3. 驗證帳戶餘額，之後你在**任何資料夾**跟 AI 說「幫我生成一張產品海報」、「把這張圖背景換掉」、「做一段 5 秒鏡頭視頻」、「配一段旁白語音」，它就會自動調用模型並把成品下載到本地。

---

## 手動一行安裝

需要本機有 Node.js 18+ 與 Git。

**macOS / Linux：**
```bash
curl -fsSL https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.sh | WOWIDEA_API_KEY='sk-你的Key' bash
```
*(若不想讓 Key 出現在終端歷史紀錄中，去掉 `WOWIDEA_API_KEY='...'`，腳本會隱藏輸入提示你貼上。)*

**Windows PowerShell：**
```powershell
$env:WOWIDEA_API_KEY="sk-你的Key"; irm https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.ps1 | iex
```

---

## 支援的模型與能力概覽

安裝後 AI 會按需讀取 `skills/wowidea/` 下的說明，自動選擇最合適的模型並下載結果：

| 模態 | 接口路徑 | 代表模型 |
| :--- | :--- | :--- |
| **圖片生成 / 參考圖編輯** | `POST /api/v1/images/generations` | `Nano Banana 2.1`、`Nano Banana Pro`、`gpt-image-2.6-flare`、`gpt-image-2.5-flare`、`mj-v8.2`、`Seedream-5.5` |
| **視頻生成 / 首尾幀 / 多模態** | `POST /api/v1/video/generations` | `豆包Seedance-2.5`（含 480p 樣片 → 1080p 成片）、`Seedance-2.5-Flash`、`MiniMax-H3`、`Wan3.0-Video`、`Google Omni` |
| **語音合成（TTS 配音）** | `POST /api/v1/speech/generations` | `MiniMax-Speech-2.8-HD`、`MiniMax-Speech-2.8-Turbo`（內建 80+ 中英日韓粵音色） |
| **本地參考素材上傳** | `POST /api/v1/files/upload` | 本地圖片 / 視頻 / 音頻自動上傳轉為 HTTPS 引用連結 |
| **多模態理解與對話** | `POST /api/v1/chat/completions` | `mimo-v2.6-pro`、`Qwen3.8-Max`、`glm-5.3-flash`、`deepseek-flash` |

---

## 倉庫目錄結構

```text
wowidea-skill/
├── README.md                        # 快速上手說明
├── INSTALL.md                       # 專供 AI 助手讀取的無交互安裝規範
├── scripts/
│   ├── install.sh                   # macOS / Linux 零依賴安裝與環境配置腳本
│   └── install.ps1                  # Windows PowerShell 安裝與環境配置腳本
└── skills/
    └── wowidea/
        ├── SKILL.md                 # 核心技能入口（觸發條件、模型選型表、HTTP 總綱）
        ├── scripts/
        │   └── wowidea.mjs          # 零依賴單檔工具（自動上傳參考圖、提交、輪詢、下載到本地）
        └── references/              # 按需載入的各模態參數字典（平時不佔 AI 上下文）
            ├── image.md             # 圖片生成與修圖參數手冊
            ├── video.md             # 視頻生成與 Seedance 樣片轉成片手冊
            ├── audio.md             # TTS 語音合成音色與音頻說明
            └── files-and-chat.md    # 本地檔案上傳、多模態理解與任務輪詢規則
```
