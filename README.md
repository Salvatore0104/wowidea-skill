# wowidea-skill

让没有原生生图、生视频、配音能力的 AI 助手（Claude Code、Cursor、Codex、Gemini CLI、Antigravity 等）直接调用 [wowidea.top](https://wowidea.top) 上的多模态大模型。

**纯技能说明书 + 单文件零依赖请求脚本**：无需 `npm install`、无需编译打包、不装任何原生扩展，2 秒装完即用。

---

## 一句话让 AI 帮你装（最推荐）

先在 [wowidea.top/user/api-key](https://wowidea.top/user/api-key) 创建一把 API Key，然后把下面这段话发给你的 AI 助手：

```text
帮我安装 wowidea-skill（https://github.com/Salvatore0104/wowidea-skill），按仓库里的 INSTALL.md 操作，我的 Key 是 sk-你的Key
```

AI 会自动完成三件事：
1. 把 `WOWIDEA_API_KEY` 安全写入本机环境（`~/.config/wowidea/api_key` 及 `~/.zshenv` / `~/.zshrc`，权限 `600`，不回显、不进代码库）。
2. 把技能挂载到 Claude Code、Cursor、Codex、Gemini、Antigravity 的全局技能目录。
3. 验证账户余额。之后你在**任意文件夹**对 AI 说「帮我生成一张产品海报」「把这张图背景换掉」「做一段 5 秒镜头视频」「配一段旁白语音」，它就会自动调用对应模型并把成品下载到本地。

---

## 手动一行安装

需要本机已安装 Node.js 18+ 与 Git。

**macOS / Linux：**
```bash
curl -fsSL https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.sh | WOWIDEA_API_KEY='sk-你的Key' bash
```
*(如果不想让 Key 留在终端历史记录里，去掉 `WOWIDEA_API_KEY='...'`，脚本会隐藏回显提示你输入。)*

**Windows PowerShell：**
```powershell
$env:WOWIDEA_API_KEY="sk-你的Key"; irm https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.ps1 | iex
```

---

## 支持的模型与能力概览

安装后 AI 会按需读取 `skills/wowidea/` 下的说明，自动选择最合适的模型并下载结果：

| 模态 | 接口路径 | 代表模型 |
| :--- | :--- | :--- |
| **图片生成 / 参考图编辑** | `POST /api/v1/images/generations` | `Nano Banana 2.1`、`Nano Banana 2`、`Nano Banana Pro`、`gpt-image-2.6-flare`、`gpt-image-2.5-flare`、`mj-v8.2`、`Seedream-5.5` |
| **视频生成 / 首尾帧 / 多模态** | `POST /api/v1/video/generations` | `豆包Seedance-2.5`（含 480p 样片 → 1080p 成片）、`Seedance-2.5-Flash`、`MiniMax-H3`、`Wan3.0-Video`、`Google Omni` |
| **语音合成（TTS 配音）** | `POST /api/v1/speech/generations` | `MiniMax-Speech-2.8-HD`、`MiniMax-Speech-2.8-Turbo`（内置 80+ 中英日韩粤音色） |
| **本地参考素材上传** | `POST /api/v1/files/upload` | 本地图片 / 视频 / 音频自动上传转为 HTTPS 引用链接 |
| **多模态理解与对话** | `POST /api/v1/chat/completions` | `mimo-v2.6-pro`、`Qwen3.8-Max`、`glm-5.3-flash`、`deepseek-flash` |

---

## 仓库目录结构

```text
wowidea-skill/
├── README.md                        # 项目说明（简体中文）
├── INSTALL.md                       # 专供 AI 助手读取的无交互安装规范
├── scripts/
│   ├── install.sh                   # macOS / Linux 零依赖安装与环境配置脚本
│   └── install.ps1                  # Windows PowerShell 安装与环境配置脚本
└── skills/
    └── wowidea/
        ├── SKILL.md                 # 核心技能入口（触发条件、模型选型表、HTTP 总纲）
        ├── scripts/
        │   └── wowidea.mjs          # 零依赖单文件工具（自动上传参考图、提交、轮询、下载到本地）
        └── references/              # 按需加载的各模态参数手册（平时不占 AI 上下文）
            ├── image.md             # 图片生成与修图参数手册
            ├── video.md             # 视频生成与 Seedance 样片转成片手册
            ├── audio.md             # TTS 语音合成音色与音频说明
            └── files-and-chat.md    # 本地文件上传、多模态理解与任务轮询规则
```
