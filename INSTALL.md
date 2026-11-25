# AI 助手安装指南（Agent Install Instructions）

当用户对你说「帮我安装 `wowidea-skill`，我的 Key 是 `sk-...`」时，请严格按以下步骤无交互执行。

## 安全铁律（必须遵守）

1. **禁止回显密钥**：绝对不要 `echo`、`printf`、`printenv` 或在回复消息中打印用户的 `sk-...` 明文。
2. **禁止写入项目仓库**：不要把密钥写进当前工作区的 `.env`、`README.md` 或任何 Git 跟踪文件。安装脚本会自动将密钥以 `600` 权限存入用户主目录 `~/.config/wowidea/api_key` 与个人 Shell 启动文件（`~/.zshenv`、`~/.zshrc`、`~/.bashrc`）。
3. **零编译、零 `sudo`**：本项目为纯技能文档与零依赖脚本，不需要 `npm install`、不需要 `npm build`、禁止使用 `sudo`。

---

## 步骤 1：检查 Node.js（需 18+）

macOS / Linux：
```bash
node -v
```
若未安装 Node.js 或主版本低于 18，请停下来提示用户从 https://nodejs.org/ 安装，不要使用 `sudo` 代装。

---

## 步骤 2：执行一键安装与环境配置

将下方单引号内的占位符替换为用户消息中提供的真实 Key（不要打印该变量），直接执行：

### macOS / Linux（仓库尚未在本地时）
```bash
curl -fsSL https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.sh | WOWIDEA_API_KEY='用户提供的Key' bash
```
*(若网络拉取 `raw.githubusercontent.com` 失败，可先执行 `git clone --depth 1 https://github.com/Salvatore0104/wowidea-skill.git ~/.wowidea-skill`，再执行 `WOWIDEA_API_KEY='用户提供的Key' bash ~/.wowidea-skill/scripts/install.sh </dev/null`)*

### macOS / Linux（当前已在仓库目录内时）
```bash
WOWIDEA_API_KEY='用户提供的Key' bash ./scripts/install.sh </dev/null
```

### Windows PowerShell
```powershell
$env:WOWIDEA_API_KEY = '用户提供的Key'
irm https://raw.githubusercontent.com/Salvatore0104/wowidea-skill/main/scripts/install.ps1 | iex
```
*(若已在本地仓库目录内：`& "$PWD\scripts\install.ps1"`)*

---

## 步骤 3：确认安装结果并回复用户

安装脚本会自动完成四件事：
1. 将仓库同步至 `~/.wowidea-skill`。
2. 将 `WOWIDEA_API_KEY` 写入 `~/.config/wowidea/api_key`（权限 `600`）及 Shell 环境变量。
3. 将 `skills/wowidea` 自动挂载到 `~/.claude/skills/wowidea`、`~/.cursor/skills/wowidea`、`~/.codex/skills/wowidea`、`~/.gemini/skills/wowidea`、`~/.gemini/config/skills/wowidea` 与 `~/.agents/skills/wowidea`。
4. 调用 `GET /api/v1/balance` 验证连通性与余额。

最后向用户简短汇报：
- 技能已挂载完成。
- 账户余额验证是否通过（只报余额数字，**不要复述 Key**）。
- 现在可以直接在对话中要求生图、改图、生视频或语音配音。
