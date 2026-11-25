# Video Generation & Finalization (`POST /api/v1/video/generations`)

## 1. Helper Command Examples

```bash
# Option A: Seedance 2.5 low-cost 480p Draft -> confirm -> 1080p Final
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" --draft \
  --prompt "0-2s: Static close-up of a ceramic cup on oak table. 2-5s: Slow push-in as warm steam rises." \
  --duration 5 --ratio 16:9 --out ./output

# Check eligibility/preview (no charge), then render 1080p final with --yes
node ./scripts/wowidea.mjs video-finalize <draftTaskId>
node ./scripts/wowidea.mjs video-finalize <draftTaskId> --yes --out ./output

# Option B: Direct high-res video generation (no draft stage)
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" \
  --prompt "Slow orbital product shot around a matte black speaker on dark slate" \
  --duration 5 --resolution 1080p --ratio 16:9 --no-audio --out ./output

# Option C: Image-to-video / First-Last-Frame (local images auto-upload)
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" \
  --mode first_last_frame \
  --ref ./start-frame.png --ref ./end-frame.png \
  --prompt "Smooth camera dolly transitioning from the wide desk view in Frame 1 to the macro dial view in Frame 2" \
  --duration 5 --resolution 720p --ratio adaptive --out ./output
```

## 2. Live Video Models & Specs

Run `node ./scripts/wowidea.mjs models --type video` or `models --id "<model>"` to inspect live channel constraints.

| Model ID | Resolutions | Duration | Audio | Key Capabilities & Notes |
| :--- | :--- | :--- | :--- | :--- |
| `豆包Seedance-2.5` | `480p`, `720p`, `1080p`, `4K` | `4`–`30`s | Optional | Flagship Volces video model. Supports `text_to_video`, `image_reference`, `first_last_frame`, `video_reference`, and `draft: true` (`480p` -> `1080p` final). |
| `Seedance-2.5-Flash` | `480p`, `720p` | `4`–`30`s | Optional | Fast standalone 2.5 variant for quick 480p/720p clips (not a draft-to-final model). |
| `豆包Seedance-2.0` | `480p`, `720p`, `1080p`, `2160p` | `4`–`15`s | Optional | Also has `豆包Seedance-2.0-fast` and `豆包Seedance-2.0-mini` (`480p`/`720p`). |
| `MiniMax-H3` | `720p`, `1440p` | `4`–`15`s | Always (`true`) | Audiovisual cinematic generation (`audio: true` required). Supports text, `first_last_frame` (`aspect_ratio: "adaptive"`), and image/video references. |
| `MiniMax-H3-Max` | `480p`, `720p` | `5`–`15`s | Optional | Text-to-video and first/last frame (`5`–`15`s). |
| `Wan3.0-Video` | `480p`, `720p`, `1080p` | `2`–`30`s | Optional | Also `Wan3.0-Video-Prime`. Supports text, first/last frame, and up to 10 ref images / 5 videos / 5 audios. |
| `Google Omni` | `720p` | `10`s (fixed) | Optional | Fixed `duration: 10`, `resolution: "720p"`, `aspect_ratio`: `16:9` or `9:16`. |
| `muse-video-ext` | `720p` | `2`–`10`s | Included | Audio-enabled short clips from text or up to 9 reference images. |

## 3. Raw HTTP Request Schemas

### A. Direct Video Generation (`POST /api/v1/video/generations`)

Always send `watermark: false` and explicit `duration`, `resolution`, `aspect_ratio`, and `audio` (boolean). Including both `prompt` and `content` ensures compatibility across standard and multimodal (`omni_video`) routes:

```json
{
  "model": "豆包Seedance-2.5",
  "mode": "text_to_video",
  "prompt": "0-3s: Frontal close-up of a ceramic cup. 3-5s: Slow push-in as steam rises.",
  "content": [
    { "type": "text", "text": "0-3s: Frontal close-up of a ceramic cup. 3-5s: Slow push-in as steam rises." }
  ],
  "duration": 5,
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "audio": false,
  "watermark": false
}
```

With reference images (uploaded via `POST /api/v1/files/upload` first):
- **Reference mode (`mode: "image_reference"`)**: add `"image_urls": ["https://..."]` and append `{ "type": "image_url", "role": "reference_image", "image_url": { "url": "https://..." } }` to `content`. (For `MiniMax-H3`, also include `"videoGenerateMode": "omni_reference"` and `"audio": true`.)
- **First/Last frame (`mode: "first_last_frame"`)**: set `"aspect_ratio": "adaptive"`, pass 1 or 2 URLs in `image_urls`, and use roles `"first_frame"` and `"last_frame"` in `content`.

### B. Seedance 2.5 Draft -> 1080p Final Contract

1. **Submit Draft** (`POST /api/v1/video/generations`):
   - **Important**: Send `"model": "豆包Seedance-2.5"` (never send `"Seedance-2.5-Draft"` or `"Seedance-2.5-Final"` as the wire `model` string!), `"draft": true`, and `"resolution": "480p"`:
   ```json
   {
     "model": "豆包Seedance-2.5",
     "content": [{ "type": "text", "text": "Camera slowly approaches a ceramic cup" }],
     "draft": true,
     "resolution": "480p",
     "duration": 5,
     "aspect_ratio": "16:9",
     "audio": false
   }
   ```
2. **Poll Draft**: `GET /api/v1/ai/result/{taskId}` until `status === "success"`. Read `videoGeneration.resultId` (fallback: `{taskId}:0`). Drafts remain valid for ~7 days.
3. **Preview Finalization**: `GET /api/v1/video/results/{sourceResultId}/finalization` (checks `eligible` and `existingTaskId`).
4. **Submit 1080p Final** (only after user confirmation):
   `POST /api/v1/video/finalizations`
   ```json
   {
     "sourceResultId": "<sourceResultId>",
     "targetResolution": "1080p",
     "outputFormat": "mp4",
     "watermark": false,
     "returnLastFrame": false,
     "idempotencyKey": "<uuid>"
   }
   ```
   Then poll the returned `task_id` via `GET /api/v1/ai/result/{finalTaskId}` and download immediately.
