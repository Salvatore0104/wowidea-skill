---
name: wowidea
description: >-
  通过 Wowidea API (wowidea.top) 调用多模态模型生成与编辑图片、视频、语音配音 (TTS) 及多模态理解。当用户要求生图、修图、海报排版、产品图、生成视频片段、首尾帧动画或语音合成（尤其在宿主 AI 没有原生生图/生视频/配音能力时）立即激活此技能。
---

# Wowidea 多模态 API 技能

当用户要求生成或编辑图片、视频、语音/音频时：
- **禁止因没有内置生图/视频工具而拒绝**，也**禁止用 SVG 矢量简笔画替代真实图片**。
- 使用本技能目录自带的零依赖脚本 `[wowidea.mjs](./scripts/wowidea.mjs)` 或直接发送 HTTP 请求调用 `https://wowidea.top/api/v1`。
- **密钥安全**：从环境变量 `WOWIDEA_API_KEY` 或 `~/.config/wowidea/api_key` 读取密钥。严禁回显、打印或在代码仓库中写入密钥明文。

## 1. 快速调用方式（推荐）

直接用 `node` 运行相对于本 `SKILL.md` 的 `./scripts/wowidea.mjs`（仅需 Node.js 18+，无需 `npm install`）。脚本会自动完成：**本地参考文件上传 → 提交异步任务 → 轮询 `GET /api/v1/ai/result/{taskId}` → 下载成品文件到本地**。

```bash
SKILL_SCRIPT="<本SKILL.md所在目录>/scripts/wowidea.mjs"

# 查询实时可用模型与账户余额
node "$SKILL_SCRIPT" models --type image
node "$SKILL_SCRIPT" models --id "Nano Banana 2.1"
node "$SKILL_SCRIPT" balance

# 图片生成（传入 --ref ./input.png 可自动上传参考图做修图/改图，支持重复传多张）
node "$SKILL_SCRIPT" image \
  --model "Nano Banana 2.1" \
  --prompt "极简陶瓷咖啡杯放在浅橡木桌面上，清晨柔和自然光" \
  --ratio 3:4 --resolution 2K --out ./output

# 视频生成（加 --draft 先生成低成本 480p Seedance 2.5 样片；去掉 --draft 为直接生成）
node "$SKILL_SCRIPT" video \
  --model "豆包Seedance-2.5" --draft \
  --prompt "镜头缓慢推近桌面上的陶瓷咖啡杯，杯口升起细微热气" \
  --duration 5 --ratio 16:9 --out ./output

# 将确认满意的 Seedance 2.5 样片升级为 1080p 成片（先预览资格，用户确认后再加 --yes 扣费）
node "$SKILL_SCRIPT" video-finalize <draftTaskId>
node "$SKILL_SCRIPT" video-finalize <draftTaskId> --yes --out ./output

# 语音合成（TTS 旁白配音）
node "$SKILL_SCRIPT" speech \
  --model "MiniMax-Speech-2.8-HD" \
  --voice "male-qn-qingse" \
  --text "欢迎使用 Wowidea 多模态接口服务。" \
  --out ./output
```

## 2. 模型选型速查表

根据任务需求选择模型（可通过 `models --type <image|video|speech>` 查看实时启用列表）：

| 场景 | 首选模型 (`model`) | 备选与说明 |
| :--- | :--- | :--- |
| 日常出图与参考图修改 | `Nano Banana 2.1` / `Nano Banana 2` | 精细修图选 `Nano Banana Pro`；支持 `1K`/`2K`/`4K` |
| 海报排版 / 画面内精准文字 | `gpt-image-2.6-flare` | 需透明背景选 `gpt-image-2.5-flare`（`--background transparent`） |
| 风格探索 / 概念视觉提案 | `mj-v8.2` | 快速迭代选 `mj-v8.2-fast`（编辑仅支持单张参考图） |
| 电商商品图 / 中文审美 | `Seedream-5.5` | 备选 `Seedream-5.0-Pro`、`Doubao-Seedream-5.0-flash` |
| 视频先审样片再出 1080p 成片 | `豆包Seedance-2.5` (`--draft`) | 样片固定 `draft: true, resolution: "480p"`；成片走 `video-finalize --yes` |
| 直接生视频 / 多模态视频 | `豆包Seedance-2.5` | 快速草稿选 `Seedance-2.5-Flash`，有声剧情选 `MiniMax-H3`，多素材选 `Wan3.0-Video` |
| 旁白解说 / 角色配音 (TTS) | `MiniMax-Speech-2.8-HD` | 批量快速配音选 `MiniMax-Speech-2.8-Turbo` |

## 3. 原生 HTTP 接口总纲（直连 `curl` / 自定义代码时使用）

- **接口基址**：`https://wowidea.top/api`（所有 API Key 接口均以 `/v1/...` 开头）。
- **请求头**：`Authorization: Bearer $WOWIDEA_API_KEY`、`Content-Type: application/json`、`x-async: true`、`Idempotency-Key: <uuid>`。
- **核心端点**：
  - `GET /v1/models` — 查询实时启用模型与具体参数约束（`capabilities`）。
  - `GET /v1/balance` — 查询账户积分余额。
  - `POST /v1/files/upload` — `multipart/form-data`（字段 `file`、`fileName`）上传本地素材，换取公网 HTTPS URL。
  - `POST /v1/images/generations` — 图片生成与参考图编辑（参考图 URL 数组放在 `image` 字段）。
  - `POST /v1/video/generations` — 文生视频、首尾帧、多模态参考视频。
  - `POST /v1/speech/generations` — 语音合成（必填 `model` 与 `text`，音色字段为 `voice_id`）。
  - `GET /v1/ai/result/{taskId}` — 轮询异步任务（`submitted` / `process` → `success` / `failed`），从 `output[]` 或 `data[].url` 提取链接并立即下载到本地（签名链接约 24 小时过期）。

## 4. 按需查阅各模态详细手册

仅在执行对应模态任务时按需读取，避免浪费上下文：
- **图片生成与参考图编辑细则**：[references/image.md](./references/image.md)
- **视频生成与 Seedance 样片转成片细则**：[references/video.md](./references/video.md)
- **语音合成 (TTS) 音色表与音频说明**：[references/audio.md](./references/audio.md)
- **本地素材上传、多模态对话理解与 3D 接口**：[references/files-and-chat.md](./references/files-and-chat.md)
