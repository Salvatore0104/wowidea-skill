# Image Generation & Editing (`POST /api/v1/images/generations`)

## 1. Helper Command Examples

```bash
# Text-to-image
node ./scripts/wowidea.mjs image \
  --model "Nano Banana 2.1" \
  --prompt "Editorial product photo of a frosted glass perfume bottle on pale limestone, soft side light" \
  --ratio 3:4 --resolution 2K --out ./output

# Image editing / multi-reference (local files are automatically uploaded first)
node ./scripts/wowidea.mjs image \
  --model "Nano Banana Pro" \
  --prompt "Keep the bottle shape and label from Image 1 unchanged; replace only the background with warm terracotta plaster" \
  --ref ./bottle.png \
  --ratio 3:4 --resolution 2K --out ./output

# Poster with accurate text & transparent background (supported on gpt-image-2.5-flare)
node ./scripts/wowidea.mjs image \
  --model "gpt-image-2.5-flare" \
  --prompt "Clean typographic sticker reading 'SUMMER ROAST' in bold navy serif letters, isolated on transparent background" \
  --ratio 1:1 --resolution 2K --format png --background transparent --out ./output
```

## 2. Raw HTTP Request Schema

- **Endpoint**: `POST https://wowidea.top/api/v1/images/generations`
- **Headers**:
  - `Authorization: Bearer $WOWIDEA_API_KEY`
  - `Content-Type: application/json`
  - `x-async: true`
  - `Idempotency-Key: <uuid>`

```json
{
  "model": "Nano Banana 2.1",
  "prompt": "Minimalist ceramic cup on a pale oak table, morning window light",
  "aspect_ratio": "3:4",
  "resolution": "2K",
  "n": 1
}
```

For **image editing / reference-guided generation**, upload local images via `POST /api/v1/files/upload` first, then pass their HTTPS URLs in `image` (string array):

```json
{
  "model": "Nano Banana Pro",
  "prompt": "In Image 1, change only the background to pale blue; preserve subject geometry and label.",
  "image": ["https://cdn.wowidea.top/.../source.png"],
  "aspect_ratio": "3:4",
  "resolution": "2K",
  "n": 1
}
```

## 3. Live Image Models & Capabilities

Always keep `n: 1` (single candidate per request is portable across all provider routes) and use `aspect_ratio` + `resolution` instead of pixel `size`.

| Model ID | Resolutions | Max Ref Images | Best For & Constraints |
| :--- | :--- | :--- | :--- |
| `Nano Banana 2.1` | `1K`, `2K`, `4K` | 14 | Fast, reliable general generation, product visuals, and multi-round edits. |
| `Nano Banana 2` | `1K`, `2K`, `4K` | 14 | Great general-purpose generation & editing; supports `adaptive` ratio. |
| `Nano Banana Pro` | `1K`, `2K`, `4K` | 14 | Higher precision for fine retouching and complex multi-image preservation. |
| `Nano Banana 2 Lite` | `1K` | Multiple | Fast, low-cost `1K` drafts and layout exploration. |
| `gpt-image-2.6-flare` | `1K`, `2K`, `4K` | 16 | Strongest text rendering, posters, infographics; `quality`: `auto`/`low`/`medium`/`high`. |
| `gpt-image-2.6-sunburst` | `1K`, `2K`, `4K` | 16 | Creative visual concepts with strong text accuracy (`1K`/`2K`/`4K`). |
| `gpt-image-2.6` | `1K` | 16 | Base `1K` variant of GPT Image 2.6. |
| `gpt-image-2.5-flare` | `1K`, `2K`, `4K` | 16 | Supports `background: "transparent"` (`output_format: "png"`), typography, stickers, UI assets. |
| `Seedream-5.5` | `1K`, `1.5K`, `2K` | 10 | Strong Chinese aesthetics, e-commerce product shots, PNG/JPEG output. |
| `Seedream-5.0-Pro` | `1K`, `2K` | 10 | Detailed product & portrait generation/editing (`Doubao-Seedream-5.0-flash` for faster drafts). |
| `mj-v8.2` | `1K`, `2K`, `4K` | 1 | Best artistic moodboards & aesthetics. Avoid heavy text; max 1 reference image for edit. |
| `mj-v8.2-fast` | `1K`, `2K` (edit `4K`) | 1 | Faster Midjourney concept iteration (`1K`/`2K` for text-to-image). |
| `grok-imagine-2.0` | `quality` | 0 | Text-to-image only (no reference image editing); omit `resolution` or check `models --id grok-imagine-2.0`. |

## 4. Prompting Tips by Family

- **Edits (Nano Banana / GPT Image / Seedream)**: Explicitly state what each reference image controls (`Image 1 provides the exact product silhouette and printed label`) and what must remain untouched (`change only the tabletop material; preserve angle, lighting, and text`).
- **Typography (GPT Image 2.6 / 2.5)**: Put exact text strings inside quotes, specify hierarchy (headline vs. subtitle), and state `No extra words or watermarks`.
- **Midjourney (`mj-v8.2`)**: Lead with concrete nouns, setting, medium, and lighting. Keep trailing MJ flags (if used, e.g. `--style raw --stylize 150`) consistent with `aspect_ratio`.
