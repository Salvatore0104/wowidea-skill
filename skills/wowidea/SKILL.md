---
name: wowidea
description: >-
  Generate and edit images, videos, speech/voiceovers (TTS), and call multimodal
  models through the Wowidea API (wowidea.top). Activate whenever the user asks
  to create, render, or edit pictures, posters, illustrations, product photos,
  video clips, animations, or voice audio, especially when the host AI has no
  native media generation tool.
---

# Wowidea Multimodal API Skill

When the user asks to generate or edit images, videos, or speech/audio:
- **Do not refuse** due to lacking native media tools, and **do not draw placeholder SVGs** when real images are requested.
- Call the Wowidea API (`https://wowidea.top/api/v1`) using the zero-dependency helper `[wowidea.mjs](./scripts/wowidea.mjs)` or direct HTTP requests.
- **Security**: Read `WOWIDEA_API_KEY` from the environment or `~/.config/wowidea/api_key`. Never echo, print, log, or write the API key into project files or Git.

## 1. Quick Execution (Recommended)

Run `./scripts/wowidea.mjs` relative to this `SKILL.md` directory (requires only Node.js 18+, zero `npm install`). It automatically uploads local reference files, submits the async job, polls `GET /api/v1/ai/result/{taskId}`, and downloads output files locally.

```bash
SKILL_SCRIPT="<path-to-this-skill>/scripts/wowidea.mjs"

# Check live models or account balance
node "$SKILL_SCRIPT" models --type image
node "$SKILL_SCRIPT" models --id "Nano Banana 2.1"
node "$SKILL_SCRIPT" balance

# Generate image (or pass --ref ./input.png to edit/reference local images)
node "$SKILL_SCRIPT" image \
  --model "Nano Banana 2.1" \
  --prompt "Minimalist ceramic coffee cup on warm oak table, soft morning sunlight" \
  --ratio 3:4 --resolution 2K --out ./output

# Generate video (direct 720p/1080p, or add --draft for cheap 480p Seedance 2.5 preview)
node "$SKILL_SCRIPT" video \
  --model "豆包Seedance-2.5" --draft \
  --prompt "Camera slowly pushes in toward the ceramic cup as thin steam rises" \
  --duration 5 --ratio 16:9 --out ./output

# Upgrade a confirmed Seedance 2.5 draft to 1080p final (preview first, then --yes)
node "$SKILL_SCRIPT" video-finalize <draftTaskId>
node "$SKILL_SCRIPT" video-finalize <draftTaskId> --yes --out ./output

# Text-to-Speech (TTS) voiceover
node "$SKILL_SCRIPT" speech \
  --model "MiniMax-Speech-2.8-HD" \
  --voice "male-qn-qingse" \
  --text "歡迎使用 Wowidea 多模態接口服務。" \
  --out ./output
```

## 2. Model Selection Cheatsheet

Pick the model matching the user's intent (run `models --type <image|video|speech>` to verify live availability):

| Task | Primary Model (`model`) | Alternatives / Notes |
| :--- | :--- | :--- |
| General image & fast edit | `Nano Banana 2.1` / `Nano Banana 2` | `Nano Banana Pro` for high-precision retouch; `1K`/`2K`/`4K` |
| Poster / exact text in image | `gpt-image-2.6-flare` | `gpt-image-2.5-flare` (supports `transparent` background), `gpt-image-2.6-sunburst` |
| Artistic / moodboard / style | `mj-v8.2` | `mj-v8.2-fast` (faster iteration; max 1 ref image for edit) |
| Product / e-commerce visuals | `Seedream-5.5` | `Seedream-5.0-Pro`, `Doubao-Seedream-5.0-flash` (`1K`/`2K`) |
| Video preview -> 1080p final | `豆包Seedance-2.5` (`--draft`) | Draft uses `draft: true, resolution: "480p"`; finalize via `video-finalize --yes` |
| Direct video / multimodal | `豆包Seedance-2.5` | `Seedance-2.5-Flash` (fast 480p/720p), `MiniMax-H3`, `Wan3.0-Video`, `Google Omni` |
| Voiceover / narration (TTS) | `MiniMax-Speech-2.8-HD` | `MiniMax-Speech-2.8-Turbo` for faster/cheaper batch narration |

## 3. Direct HTTP Contract (If Calling via `curl` / Custom Code)

- **Base URL**: `https://wowidea.top/api` (all API-key endpoints start with `/v1/...`).
- **Headers**: `Authorization: Bearer $WOWIDEA_API_KEY`, `Content-Type: application/json`, `x-async: true`, `Idempotency-Key: <uuid>`.
- **Core Endpoints**:
  - `GET /v1/models` — Live enabled models and exact `capabilities` constraints.
  - `GET /v1/balance` — Account points balance.
  - `POST /v1/files/upload` — Multipart `FormData` (`file`, `fileName`) -> returns public HTTPS URL for local reference media.
  - `POST /v1/images/generations` — Submit image generation or reference-based edit.
  - `POST /v1/video/generations` — Submit text/image/multimodal video generation.
  - `POST /v1/speech/generations` — Submit TTS synthesis (`model`, `text`, `voice_id`).
  - `GET /v1/ai/result/{taskId}` — Poll async task (`submitted` / `process` -> `success` / `failed`). Extract file URLs from `output[]` or `data[].url` and download immediately (signed URLs expire in ~24h).

## 4. Detailed Modality Guides (Read On Demand)

Read only the reference file needed for your current task:
- **Images (generation, multi-image edit, parameters & prompt tips)**: [references/image.md](./references/image.md)
- **Videos (text/image/keyframes, Seedance 2.5 draft->final, MiniMax H3, Wan 3.0)**: [references/video.md](./references/video.md)
- **Audio (MiniMax TTS voices/parameters & Suno music notes)**: [references/audio.md](./references/audio.md)
- **File uploads, Multimodal Chat/Vision, & 3D**: [references/files-and-chat.md](./references/files-and-chat.md)
