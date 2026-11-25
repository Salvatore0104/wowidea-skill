# File Uploads, Multimodal Chat/Vision, & 3D

## 1. Uploading Local Reference Files (`POST /api/v1/files/upload`)

Image editing (`image`) and reference-based video generation (`image_urls`, `video_urls`, `audio_urls`) require publicly reachable `https://` URLs. Never pass local file paths or raw Base64 strings directly into generation JSON fields.

- **With `wowidea.mjs`**: Simply pass `--ref ./local-photo.png` (or `--video-ref ./clip.mp4`, `--audio-ref ./voice.mp3`) — the script uploads local files automatically! Or upload standalone:
  ```bash
  node ./scripts/wowidea.mjs upload ./photo.png
  ```
- **Raw HTTP (`curl`)**:
  ```bash
  curl -sS -X POST "https://wowidea.top/api/v1/files/upload" \
    -H "Authorization: Bearer $WOWIDEA_API_KEY" \
    -F "file=@./photo.png" \
    -F "fileName=photo.png"
  ```
  Extract the returned HTTPS URL (from `url` or `data.url`).

## 2. Text & Multimodal Understanding (`POST /api/v1/chat/completions`)

Wowidea also exposes OpenAI-compatible (`/api/v1/chat/completions`, `/api/v1/responses`) and Anthropic-compatible (`/api/v1/messages`) endpoints for text generation and image/video/audio understanding.

- **Enabled Models** (verify via `node ./scripts/wowidea.mjs models --type text`):
  - `mimo-v2.6-pro` — Text, image, **audio**, and **video** understanding (`1M` context)
  - `Qwen3.8-Max` — Text, coding, image & video analysis
  - `glm-5.3-flash` — Fast text, image & video analysis
  - `deepseek-flash` — Fast reasoning, coding, and image analysis
  - `mimo-v2.6-flash` — Fast text & image analysis

```bash
# Quick chat or vision analysis (local images auto-upload)
node ./scripts/wowidea.mjs chat \
  --model "Qwen3.8-Max" \
  --image ./poster-draft.png \
  --prompt "檢查這張海報裡的文字拼寫與排版層級，給出修改建議"
```

## 3. 3D Mesh Generation (`POST /api/v1/mesh3d/generate/text`)

- **Endpoint**: `POST https://wowidea.top/api/v1/mesh3d/generate/text`
- Before submitting a 3D request, check `node ./scripts/wowidea.mjs models --type 3d` to confirm a 3D provider (such as `Trip3D-v3.1` / `Trip3D-P1`) is currently enabled on the account. If `count: 0`, tell the user no 3D model channel is currently enabled on `wowidea.top`.
- When enabled, submit via:
  ```bash
  node ./scripts/wowidea.mjs request POST /v1/mesh3d/generate/text \
    --body '{"model":"Trip3D-v3.1","prompt":"Low-poly stylized wooden treasure chest"}' \
    --wait --out ./output
  ```

## 4. Polling & Task Recovery Rules

- **Poll Endpoint**: `GET https://wowidea.top/api/v1/ai/result/{taskId}` (fallback: `GET /api/v1/tasks/{taskId}`).
- **Status Lifecycle**: `submitted` / `queued` / `pending` / `process` / `running` -> `success` / `succeeded` / `completed` (or `failed` / `cancelled`). Note: a message containing `"is processing"` while status is `process`/`submitted` is normal progress, **not** an error.
- **No Blind Retries**: If a network timeout happens after submitting a paid generation request, check recent tasks via `node ./scripts/wowidea.mjs request GET "/v1/tasks?page=1&page_size=10"` before submitting a duplicate job.
- **Download Promptly**: Signed CDN/OSS URLs for generated media may expire after ~24 hours; always download outputs to local disk immediately.
