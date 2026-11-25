# 本地素材上传、多模态理解与 3D 接口手册

## 1. 本地参考文件上传（`POST /api/v1/files/upload`）

图片编辑（`image`）与视频多模态参考（`image_urls`、`video_urls`、`audio_urls`）均要求传入公网可访问的 `https://` URL，不能直接传本地路径或 Base64。

- **使用 `wowidea.mjs` 时**：直接传 `--ref ./local-photo.png`（或 `--video-ref ./clip.mp4`、`--audio-ref ./voice.mp3`），脚本会自动上传本地文件并填入 URL。也可单独上传：
  ```bash
  node ./scripts/wowidea.mjs upload ./photo.png
  ```
- **使用 `curl` 直连时**：
  ```bash
  curl -sS -X POST "https://wowidea.top/api/v1/files/upload" \
    -H "Authorization: Bearer $WOWIDEA_API_KEY" \
    -F "file=@./photo.png" \
    -F "fileName=photo.png"
  ```
  从响应中提取 `https://cdn.wowidea.top/...` 地址即可用于后续生成请求。

## 2. 文本与多模态理解对话（`POST /api/v1/chat/completions`）

平台同时提供兼容 OpenAI（`/api/v1/chat/completions`、`/api/v1/responses`）与 Anthropic（`/api/v1/messages`）协议的文本及多模态理解接口。

- **当前可用理解模型**（可通过 `node ./scripts/wowidea.mjs models --type text` 核对）：
  - `mimo-v2.6-pro` — 支持文本、图片、**音频**、**视频**多模态理解（`1M` 上下文）
  - `Qwen3.8-Max` — 文本推理、代码辅助、图片与视频内容分析
  - `glm-5.3-flash` — 快速文本、图片与视频内容分析
  - `deepseek-flash` — 快速文本推理、代码与图像问答
  - `mimo-v2.6-flash` — 快速文本与图像理解

```bash
# 快速图文分析示例（本地图片会自动上传）
node ./scripts/wowidea.mjs chat \
  --model "Qwen3.8-Max" \
  --image ./poster-draft.png \
  --prompt "检查这张海报中的文字拼写与排版层级，给出修改建议"
```

## 3. 3D 模型生成接口（`POST /api/v1/mesh3d/generate/text`）

- 调用前请先运行 `node ./scripts/wowidea.mjs models --type 3d` 检查当前账户是否已启用 3D 渠道（如 `Trip3D-v3.1` / `Trip3D-P1`）。若返回 `count: 0`，请告知用户当前后台未开启 3D 模型渠道。
- 渠道开启时可通过通用 `request` 子命令调用并轮询下载：
  ```bash
  node ./scripts/wowidea.mjs request POST /v1/mesh3d/generate/text \
    --body '{"model":"Trip3D-v3.1","prompt":"Low-poly stylized wooden treasure chest"}' \
    --wait --out ./output
  ```

## 4. 异步轮询与防重提规则

- **查询端点**：`GET https://wowidea.top/api/v1/ai/result/{taskId}`（备选：`GET /api/v1/tasks/{taskId}`）。
- **状态流转**：`submitted` / `queued` / `pending` / `process` / `running` → `success` / `succeeded` / `completed`（失败为 `failed` / `cancelled`）。注意：当状态仍为处理中且 `message` 含 `"is processing"` 时属于正常排队生成，**不是报错**。
- **避免重复扣费**：若提交付费任务时发生网络超时，先通过 `node ./scripts/wowidea.mjs request GET "/v1/tasks?page=1&page_size=10"` 查看最近任务是否已入队，不要盲目重试提交。
- **及时下载成品**：生成的图片、视频、音频签名链接通常在约 24 小时后过期，任务完成后应立即下载到本地目录。
