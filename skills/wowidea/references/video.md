# 视频生成与样片成片手册（`POST /api/v1/video/generations`）

## 1. 脚本调用示例

```bash
# 方式 A：Seedance 2.5 先出 480p 低成本样片 → 用户确认后转 1080p 成片
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" --draft \
  --prompt "0-2秒：橡木桌上陶瓷杯的正面近景定镜。2-5秒：镜头缓慢推近，杯口升起柔和热气。" \
  --duration 5 --ratio 16:9 --out ./output

# 先预览成片资格（不扣费），用户确认后再加 --yes 提交 1080p 成片
node ./scripts/wowidea.mjs video-finalize <draftTaskId>
node ./scripts/wowidea.mjs video-finalize <draftTaskId> --yes --out ./output

# 方式 B：直接生成高清视频（不经过样片）
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" \
  --prompt "镜头围绕深色岩板上的哑光黑音箱缓慢环绕推进" \
  --duration 5 --resolution 1080p --ratio 16:9 --no-audio --out ./output

# 方式 C：首尾帧过渡 / 参考图生视频（本地图片自动上传）
node ./scripts/wowidea.mjs video \
  --model "豆包Seedance-2.5" \
  --mode first_last_frame \
  --ref ./start-frame.png --ref ./end-frame.png \
  --prompt "镜头从首帧的书桌全景平滑推进至尾帧的表盘微距特写" \
  --duration 5 --resolution 720p --ratio adaptive --out ./output
```

## 2. 在线视频模型与规格对照

运行 `node ./scripts/wowidea.mjs models --type video` 或 `models --id "<模型名>"` 可查看实时参数范围。

| 模型 ID (`model`) | 可选分辨率 | 时长范围 | 音频 | 核心特点与限制 |
| :--- | :--- | :--- | :--- | :--- |
| `豆包Seedance-2.5` | `480p`, `720p`, `1080p`, `4K` | `4`–`30` 秒 | 可选 | 主力旗舰视频模型。支持文生视频、参考图、首尾帧、视频参考，以及 `draft: true`（`480p` 样片 → `1080p` 成片）。 |
| `Seedance-2.5-Flash` | `480p`, `720p` | `4`–`30` 秒 | 可选 | 2.5 快速独立型号，适合快速出 480p/720p 短片（不可转成片）。 |
| `豆包Seedance-2.0` | `480p`, `720p`, `1080p`, `2160p` | `4`–`15` 秒 | 可选 | 另有 `豆包Seedance-2.0-fast` 与低成本 `豆包Seedance-2.0-mini`（`480p`/`720p`）。 |
| `MiniMax-H3` | `720p`, `1440p` | `4`–`15` 秒 | 必选 (`true`) | 音画一体剧情镜头（`audio` 必须为 `true`）；支持文生视频、首尾帧（`aspect_ratio: "adaptive"`）与多图参考。 |
| `MiniMax-H3-Max` | `480p`, `720p` | `5`–`15` 秒 | 可选 | 支持文生视频与首尾帧（`5`–`15` 秒）。 |
| `Wan3.0-Video` | `480p`, `720p`, `1080p` | `2`–`30` 秒 | 可选 | 另有 `Wan3.0-Video-Prime`；支持文生视频、首尾帧及多模态参考（最多 10 图 / 5 视频 / 5 音频）。 |
| `Google Omni` | `720p` | 固定 `10` 秒 | 可选 | 固定 `duration: 10`、`resolution: "720p"`，比例限 `16:9` 或 `9:16`。 |
| `muse-video-ext` | `720p` | `2`–`10` 秒 | 默认带声 | 支持文字或最多 9 张参考图生成带声短视频。 |

## 3. 原生 HTTP 请求契约

### A. 直接生成视频（`POST /api/v1/video/generations`）

始终显式传入 `duration`、`resolution`、`aspect_ratio`、`audio`（布尔值）与 `watermark: false`。同时附带 `prompt` 与 `content` 数组可兼容普通与多模态（`omni_video`）渠道：

```json
{
  "model": "豆包Seedance-2.5",
  "mode": "text_to_video",
  "prompt": "0-3秒：陶瓷杯正面近景。3-5秒：镜头缓慢推近，热气升起。",
  "content": [
    { "type": "text", "text": "0-3秒：陶瓷杯正面近景。3-5秒：镜头缓慢推近，热气升起。" }
  ],
  "duration": 5,
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "audio": false,
  "watermark": false
}
```

带参考图时（先通过 `POST /api/v1/files/upload` 获取 HTTPS URL）：
- **图片参考（`mode: "image_reference"`）**：传 `"image_urls": ["https://..."]`，并在 `content` 中追加 `{ "type": "image_url", "role": "reference_image", "image_url": { "url": "https://..." } }`（若使用 `MiniMax-H3`，同时加 `"videoGenerateMode": "omni_reference"` 且 `"audio": true`）。
- **首尾帧（`mode: "first_last_frame"`）**：设 `"aspect_ratio": "adaptive"`，`image_urls` 传 1～2 张图，`content` 中的 `role` 依次填 `"first_frame"`、`"last_frame"`。

### B. Seedance 2.5 样片（Draft）转 1080p 成片（Final）协议

1. **提交 480p 样片**（`POST /api/v1/video/generations`）：
   - **关键点**：`model` 字段必须传 `"豆包Seedance-2.5"`（切勿发送别名 `"Seedance-2.5-Draft"` 或 `"Seedance-2.5-Final"`），同时带 `"draft": true` 与 `"resolution": "480p"`：
   ```json
   {
     "model": "豆包Seedance-2.5",
     "content": [{ "type": "text", "text": "镜头缓慢推近陶瓷杯" }],
     "draft": true,
     "resolution": "480p",
     "duration": 5,
     "aspect_ratio": "16:9",
     "audio": false
   }
   ```
2. **轮询样片结果**：`GET /api/v1/ai/result/{taskId}` 直到 `status === "success"`，读取响应内 `videoGeneration.resultId`（若无则取 `{taskId}:0`）。样片约 7 天内可转成片。
3. **预检成片资格**：`GET /api/v1/video/results/{sourceResultId}/finalization`（核对 `eligible` 及是否已有 `existingTaskId`）。
4. **提交 1080p 成片**（需用户确认扣费后提交）：
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
   随后对返回的 `task_id` 轮询 `GET /api/v1/ai/result/{finalTaskId}` 并立即下载 `.mp4` 文件。
