# 语音合成（TTS）与音频手册（`POST /api/v1/speech/generations`）

## 1. 脚本调用示例

```bash
# 高清配音旁白（默认模型：MiniMax-Speech-2.8-HD）
node ./scripts/wowidea.mjs speech \
  --model "MiniMax-Speech-2.8-HD" \
  --voice "male-qn-jingying" \
  --text "欢迎来到新品发布会，今天为大家介绍全新一代智能桌面音箱。" \
  --out ./output

# 快速批量配音（MiniMax-Speech-2.8-Turbo）
node ./scripts/wowidea.mjs speech \
  --model "MiniMax-Speech-2.8-Turbo" \
  --voice "female-tianmei" \
  --text "点击下方链接，立即体验！" \
  --speed 1.05 --out ./output/voiceover.mp3

# 查看全部 80+ 内置音色 ID 与简介
node ./scripts/wowidea.mjs models --id "MiniMax-Speech-2.8-HD" --full-voices
```

## 2. 原生 HTTP 语音合成接口（`POST /api/v1/speech/generations`）

- **地址**：`POST https://wowidea.top/api/v1/speech/generations`
- **请求头**：`Authorization: Bearer $WOWIDEA_API_KEY`、`Content-Type: application/json`、`x-async: true`
- **必填字段**：
  - `model`：`"MiniMax-Speech-2.8-HD"`（高保真配音）或 `"MiniMax-Speech-2.8-Turbo"`（快速合成）
  - `text`：非空朗读文本（注意：原生接口字段名为 **`text`** 而非 `prompt`，单次建议不超过 10,000 字符）
- **可选字段**：
  - `voice_id`：音色 ID（默认 `"male-qn-qingse"`）
  - `speed`：语速倍率（如 `1.0`）
  - `vol`：音量（`0.01`～`10`，默认 `1`）
  - `pitch`：音调调整整数
  - `emotion`：情绪控制（如 `"happy"`、`"sad"`、`"calm"`、`"fluent"`）
  - `format`：音频格式，可选 `"mp3"`（默认）、`"wav"`、`"flac"`、`"opus"`

```json
{
  "model": "MiniMax-Speech-2.8-HD",
  "text": "这是一段测试旁白，用于验证语音合成效果。",
  "voice_id": "male-qn-qingse",
  "format": "mp3"
}
```

提交后返回 `{"task_id": "...", "status": "submitted", "query_url": "https://wowidea.top/api/v1/ai/result/..."}`，轮询 `GET /api/v1/ai/result/{task_id}` 直到 `status === "success"`，从 `output[0]` 下载音频文件。

## 3. 常用内置音色速查表（`voice_id`）

| `voice_id` | 名称 | 性别 | 风格与适用场景 |
| :--- | :--- | :--- | :--- |
| `male-qn-jingying` | 精英青年音色 | 男 | 沉稳干练，适合商务、科技与产品旁白 |
| `male-qn-qingse` | 青涩青年音色 | 男 | 自然清新，适合剧情、校园与故事配音（默认） |
| `male-qn-badao` | 霸道青年音色 | 男 | 低沉有张力，适合角色配音 |
| `male-qn-daxuesheng` | 青年大学生音色 | 男 | 温和自然，适合科普解说与日常口播 |
| `female-shaonv` | 少女音色 | 女 | 明快活泼，适合短视频与动漫角色 |
| `female-yujie` | 御姐音色 | 女 | 成熟知性，适合品牌宣传与大片旁白 |
| `female-chengshu` | 成熟女性音色 | 女 | 稳重大气，适合纪录片与正式播报 |
| `female-tianmei` | 甜美女性音色 | 女 | 亲切柔和，适合生活种草与引导提示 |

*(支持中文、粤语、英语、日语、韩语等 80 余种内置音色，完整列表可执行 `node ./scripts/wowidea.mjs models --id "MiniMax-Speech-2.8-HD" --full-voices` 查看。)*

## 4. 音乐生成模型说明（`Suno-V6` / `Suno-V6-WILD` / `Suno-V6-MINI`）

模型目录中包含 `Suno-V6`、`Suno-V6-WILD`、`Suno-V6-MINI`（类型 `audio_generate`）。
- **当前 API Key 鉴权边界**：当前线上版本的音乐接口 `/api/music/generations` 尚未挂载在 `/v1` API Key 路由下（使用 `sk-...` 调用会返回 `401`）。
- 当用户通过 API Key 请求配音/声音时，语音旁白直接使用 `/api/v1/speech/generations`，带配乐/音效的视频可使用 `MiniMax-H3` 或 `豆包Seedance-2.5`（开启 `--audio`）；若用户专门要求生成独立 Suno 歌曲，请如实说明当前 API Key 暂未开放 `/v1` 音乐端点，需在网页端生成。
