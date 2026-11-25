# 图片生成与编辑手册（`POST /api/v1/images/generations`）

## 1. 脚本调用示例

```bash
# 文生图
node ./scripts/wowidea.mjs image \
  --model "Nano Banana 2.1" \
  --prompt "磨砂玻璃香水瓶放在浅色石灰岩台面上，柔和侧光，商业产品摄影" \
  --ratio 3:4 --resolution 2K --out ./output

# 参考图编辑 / 多图融合（本地图片会自动上传后再请求）
node ./scripts/wowidea.mjs image \
  --model "Nano Banana Pro" \
  --prompt "保留图 1 香水瓶的瓶身轮廓与标签文字不变，仅将背景替换为暖赤陶色肌理墙面" \
  --ref ./bottle.png \
  --ratio 3:4 --resolution 2K --out ./output

# 带精准文字与透明背景的贴纸 / 海报元素（gpt-image-2.5-flare 支持透明底）
node ./scripts/wowidea.mjs image \
  --model "gpt-image-2.5-flare" \
  --prompt "干净的排版贴纸，深海军蓝衬线字体写着 \"SUMMER ROAST\"，透明背景" \
  --ratio 1:1 --resolution 2K --format png --background transparent --out ./output
```

## 2. 原生 HTTP 请求结构

- **地址**：`POST https://wowidea.top/api/v1/images/generations`
- **请求头**：`Authorization: Bearer $WOWIDEA_API_KEY`、`Content-Type: application/json`、`x-async: true`、`Idempotency-Key: <uuid>`

```json
{
  "model": "Nano Banana 2.1",
  "prompt": "极简陶瓷杯放在浅橡木桌面上，清晨窗边自然光",
  "aspect_ratio": "3:4",
  "resolution": "2K",
  "n": 1
}
```

**参考图编辑**时，先用 `POST /api/v1/files/upload` 将本地图片上传获取 `https://` 链接，再放入 `image` 数组：

```json
{
  "model": "Nano Banana Pro",
  "prompt": "仅把图 1 的背景改为淡蓝色，完整保留主体造型、材质光影与标签文字。",
  "image": ["https://cdn.wowidea.top/.../source.png"],
  "aspect_ratio": "3:4",
  "resolution": "2K",
  "n": 1
}
```

## 3. 在线图片模型与规格对照

统一使用 `aspect_ratio` + `resolution`（不要传像素 `size`），且默认保持 `n: 1` 以兼容所有后端调度渠道。

| 模型 ID (`model`) | 可选分辨率 | 最多参考图 | 适用场景与限制 |
| :--- | :--- | :--- | :--- |
| `Nano Banana 2.1` | `1K`, `2K`, `4K` | 14 张 | 通用高质量生图、商品图、多轮参考修图首选。 |
| `Nano Banana 2` | `1K`, `2K`, `4K` | 14 张 | 稳定快速的日常出图与编辑，支持 `adaptive` 比例。 |
| `Nano Banana Pro` | `1K`, `2K`, `4K` | 14 张 | 复杂局部精修与高保真主体一致性。 |
| `Nano Banana 2 Lite` | `1K` | 多张 | 低成本 `1K` 快速草稿（调用前建议确认渠道在线）。 |
| `gpt-image-2.6-flare` | `1K`, `2K`, `4K` | 16 张 | 画面内中英文排版、海报、信息图最稳；可选 `quality`（`auto`/`low`/`medium`/`high`）。 |
| `gpt-image-2.6-sunburst` | `1K`, `2K`, `4K` | 16 张 | 兼顾创意视觉表现与文字准确度。 |
| `gpt-image-2.6` | `1K` | 16 张 | GPT Image 2.6 基础 `1K` 版本。 |
| `gpt-image-2.5-flare` | `1K`, `2K`, `4K` | 16 张 | 支持透明背景（`background: "transparent"` + `output_format: "png"`），适合贴纸与 UI 素材。 |
| `Seedream-5.5` | `1K`, `1.5K`, `2K` | 10 张 | 中文语境理解好，适合电商视觉与国风插画。 |
| `Seedream-5.0-Pro` | `1K`, `2K` | 10 张 | 商品海报与人像细节（快速草稿可用 `Doubao-Seedream-5.0-flash`）。 |
| `mj-v8.2` | `1K`, `2K`, `4K` | 1 张 | 艺术氛围、概念设定、情绪板最强；不擅长长文字，编辑仅限 1 张参考图。 |
| `mj-v8.2-fast` | 文生图 `1K`/`2K`，编辑 `4K` | 1 张 | Midjourney 快速探索版本。 |
| `grok-imagine-2.0` | `quality` | 0 张 | 仅支持文生图，不支持参考图编辑。 |

## 4. 提示词编写要点

- **修图 / 多图参考**：明确写出每张参考图的职责（如「图 1 提供瓶身几何轮廓与标签文字，图 2 仅提供桌面石材纹理」）以及不可改动的部分。
- **海报文字排版**：将需要出现在画面中的精确文字用引号括起，写清主副标题位置层级，并注明「不要出现多余文字或水印」。
- **下载注意事项**：部分地区直连 `cdn.wowidea.top` 时 Node 原生 `fetch` 可能偶发 TLS 重置，`wowidea.mjs` 已内置自动回退 `curl` 下载；若手写脚本下载，优先使用 `curl -fsSL -o out.png "<url>"`。
