# Speech Synthesis (TTS) & Audio (`POST /api/v1/speech/generations`)

## 1. Text-to-Speech (TTS) via Helper Script

```bash
# High-definition voiceover (default model: MiniMax-Speech-2.8-HD)
node ./scripts/wowidea.mjs speech \
  --model "MiniMax-Speech-2.8-HD" \
  --voice "male-qn-jingying" \
  --text "歡迎來到新品發佈會，今天為大家介紹全新一代智能桌面音響。" \
  --out ./output

# Faster / batch voiceover with Turbo model
node ./scripts/wowidea.mjs speech \
  --model "MiniMax-Speech-2.8-Turbo" \
  --voice "female-tianmei" \
  --text "點擊下方連結，立即體驗！" \
  --speed 1.05 --out ./output/voiceover.mp3

# List all 80+ built-in voices on MiniMax Speech
node ./scripts/wowidea.mjs models --id "MiniMax-Speech-2.8-HD" --full-voices
```

## 2. Raw HTTP TTS Contract (`POST /api/v1/speech/generations`)

- **Endpoint**: `POST https://wowidea.top/api/v1/speech/generations`
- **Headers**: `Authorization: Bearer $WOWIDEA_API_KEY`, `Content-Type: application/json`, `x-async: true`
- **Required Fields**:
  - `model`: `"MiniMax-Speech-2.8-HD"` (higher fidelity) or `"MiniMax-Speech-2.8-Turbo"` (faster)
  - `text`: Non-empty string to synthesize (do **not** name this field `prompt` in raw HTTP calls; `text` is required, up to ~10,000 characters)
- **Optional Fields**:
  - `voice_id`: Built-in voice ID (default `"male-qn-qingse"`)
  - `speed`: Speech rate multiplier (e.g. `1.0`)
  - `vol`: Volume (`0.01` to `10`, default `1`)
  - `pitch`: Pitch adjustment integer
  - `emotion`: Emotion hint (supported on 2.8 models, e.g. `"happy"`, `"sad"`, `"calm"`, `"fluent"`)
  - `format`: `"mp3"` (default), `"wav"`, `"flac"`, `"opus"`

```json
{
  "model": "MiniMax-Speech-2.8-HD",
  "text": "這是一段測試旁白，用於驗證語音合成效果。",
  "voice_id": "male-qn-qingse",
  "format": "mp3"
}
```

Response returns `{"task_id": "...", "status": "submitted", "query_url": "https://wowidea.top/api/v1/ai/result/..."}`. Poll `GET /api/v1/ai/result/{task_id}` until `status === "success"`, then download `output[0]` (`.mp3` / `.wav`).

## 3. Common Built-in Voice IDs (`voice_id`)

| `voice_id` | Name | Gender | Style / Use Case |
| :--- | :--- | :--- | :--- |
| `male-qn-jingying` | 精英青年音色 | Male | Composed, confident, business & product narration |
| `male-qn-qingse` | 青澀青年音色 | Male | Natural, youthful, story & campus narration (default) |
| `male-qn-badao` | 霸道青年音色 | Male | Deep, assertive character voice |
| `male-qn-daxuesheng` | 青年大學生音色 | Male | Warm, conversational explainer |
| `female-shaonv` | 少女音色 | Female | Bright, lively short-video & character voice |
| `female-yujie` | 御姐音色 | Female | Mature, poised brand & editorial voiceover |
| `female-chengshu` | 成熟女性音色 | Female | Steady, authoritative documentary / narration |
| `female-tianmei` | 甜美女性音色 | Female | Friendly customer guide & lifestyle narration |

*(Over 80 voices across Chinese, English, Japanese, Korean, Cantonese, etc. are available — inspect the full list via `node ./scripts/wowidea.mjs models --id "MiniMax-Speech-2.8-HD" --full-voices`.)*

## 4. Music Generation (`Suno-V6`, `Suno-V6-WILD`, `Suno-V6-MINI`)

`GET /api/v1/models` lists `Suno-V6`, `Suno-V6-WILD`, and `Suno-V6-MINI` (`audio_generate`).
- **Current API Key Boundary**: On the current server version, `/api/music/generations` uses web session JWT authentication rather than `/v1` `sk-...` API keys (calling `/api/music/generations` with an `sk-...` key returns `401`).
- If the user asks for music generation via API key, test `node ./scripts/wowidea.mjs request POST /v1/music/generations --body '{"model":"Suno-V6","prompt":"..."}'` only if the server has updated `/v1` music routing; otherwise inform the user clearly that TTS (`MiniMax-Speech-2.8-HD`) and audio-enabled video (`MiniMax-H3`, `豆包Seedance-2.5`, `Wan3.0-Video`) work via API key today while Suno music currently requires the web interface.
