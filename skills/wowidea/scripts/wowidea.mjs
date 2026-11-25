#!/usr/bin/env node
/**
 * wowidea.mjs — Zero-dependency API helper for wowidea.top
 * Requires Node.js 18+ (uses built-in fetch, FormData, Blob, fs, crypto).
 * Never logs or echoes WOWIDEA_API_KEY.
 */

import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = "https://wowidea.top";
const HOST_ALIASES = { "ai.wowidea.top": DEFAULT_BASE_URL };
const TERMINAL_OK = new Set(["success", "succeeded", "completed"]);
const TERMINAL_FAIL = new Set(["failed", "error", "cancelled", "canceled"]);
const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveApiKey(explicitKey) {
  if (explicitKey?.trim()) return explicitKey.trim();
  const envKey = process.env.WOWIDEA_API_KEY || process.env.EASYAI_API_KEY;
  if (envKey?.trim()) return envKey.trim();
  const keyFile = join(homedir(), ".config", "wowidea", "api_key");
  if (existsSync(keyFile)) {
    const saved = readFileSync(keyFile, "utf8").trim();
    if (saved) return saved;
  }
  return "";
}

function canonicalBaseUrl(raw) {
  const trimmed = (raw || process.env.WOWIDEA_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  try {
    const u = new URL(trimmed);
    return HOST_ALIASES[u.hostname.toLowerCase()] || trimmed;
  } catch {
    return trimmed;
  }
}

function apiUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (cleanPath.startsWith("/api/")) return `${baseUrl}${cleanPath}`;
  const root = baseUrl.endsWith("/api") ? baseUrl : `${baseUrl}/api`;
  return `${root}${cleanPath}`;
}

function redact(value, secret) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!secret || !text) return text;
  return text.split(secret).join("[REDACTED]");
}

function fail(message, code = 2, extra = undefined, secret = "") {
  const payload = { ok: false, error: redact(message, secret), code, ...(extra ? { details: JSON.parse(redact(JSON.stringify(extra), secret)) } : {}) };
  process.stderr.write(JSON.stringify(payload, null, 2) + "\n");
  process.exit(code);
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  const multi = new Set(["ref", "video-ref", "audio-ref", "image", "header"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    let key, val;
    if (eq !== -1) {
      key = arg.slice(2, eq);
      val = arg.slice(eq + 1);
    } else {
      key = arg.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
        continue;
      }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        val = true;
      } else {
        val = next;
        i++;
      }
    }
    if (multi.has(key)) {
      flags[key] = flags[key] || [];
      flags[key].push(val);
    } else {
      flags[key] = val;
    }
  }
  return { positionals, flags };
}

async function loadJsonBody(flags, secret) {
  if (flags.body && flags["body-file"]) fail("Use either --body or --body-file, not both.", 2, undefined, secret);
  const raw = flags.body ?? (flags["body-file"] ? await readFile(resolve(String(flags["body-file"])), "utf8") : undefined);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON body must be an object");
    return parsed;
  } catch (err) {
    fail(`Invalid JSON body: ${err.message}`, 2, undefined, secret);
  }
}

async function apiRequest({ baseUrl, apiKey, method = "GET", path, body = undefined, headers = {}, timeoutMs = 120_000 }) {
  const url = apiUrl(baseUrl, path);
  const maxAttempts = method === "GET" ? 3 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const reqHeaders = {
        Accept: "application/json",
        ...(body instanceof FormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...headers,
      };
      const reqBody = body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body);
      const res = await fetch(url, { method, headers: reqHeaders, body: reqBody, signal: controller.signal });
      const text = await res.text();
      let data = text;
      try { data = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
      if (!res.ok) {
        if (method === "GET" && RETRYABLE_HTTP.has(res.status) && attempt < maxAttempts) {
          await sleep(300 * attempt);
          continue;
        }
        const errCode = res.status === 401 || res.status === 403 ? 3 : res.status === 409 ? 4 : res.status >= 400 && res.status < 500 ? 2 : 5;
        const msg = (data && typeof data === "object" && (data.message || data.error?.message || data.error)) || `HTTP ${res.status}`;
        fail(String(msg), errCode, { httpStatus: res.status, path, response: data }, apiKey);
      }
      return data;
    } catch (err) {
      if (method === "GET" && attempt < maxAttempts) {
        await sleep(300 * attempt);
        continue;
      }
      const msg = err?.name === "AbortError" ? `Request timed out after ${timeoutMs}ms (${method} ${path})` : err?.message || String(err);
      fail(msg, 5, undefined, apiKey);
    } finally {
      clearTimeout(timer);
    }
  }
}

function extractTaskId(obj) {
  if (!obj || typeof obj !== "object") return undefined;
  const direct = obj.taskId || obj.task_id || obj.id;
  if (typeof direct === "string" && direct) return direct;
  for (const k of ["data", "result", "task"]) {
    const nested = extractTaskId(obj[k]);
    if (nested) return nested;
  }
  return undefined;
}

function extractStatus(obj) {
  if (!obj || typeof obj !== "object") return "unknown";
  const noise = /is processing/i.test(`${obj.error || ""} ${obj.errorMessage || ""} ${obj.message || ""}`);
  const raw = obj.status || obj.task_status;
  if (raw) {
    const s = String(raw).toLowerCase();
    if (noise && ["running", "process", "submitted", "pending", "queued"].includes(s)) return "process";
    return s;
  }
  if (noise) return "process";
  for (const k of ["data", "result", "task"]) {
    const nested = extractStatus(obj[k]);
    if (nested !== "unknown") return nested;
  }
  return "unknown";
}

function extractUrls(value) {
  const urls = new Set();
  const allowedKeys = new Set([
    "data", "task", "result", "results", "output", "outputs", "output_content",
    "items", "images", "videos", "audios", "url", "image_url", "video_url",
    "audio_url", "download_url", "imageResultUrls", "videoResultUrls"
  ]);
  const visit = (item) => {
    if (typeof item === "string" && /^https?:\/\//i.test(item)) {
      urls.add(item);
    } else if (Array.isArray(item)) {
      item.forEach(visit);
    } else if (item && typeof item === "object") {
      for (const [k, v] of Object.entries(item)) {
        if (allowedKeys.has(k)) visit(v);
      }
    }
  };
  visit(value);
  return [...urls];
}

function findVideoGeneration(value) {
  const seen = new Set();
  const visit = (item) => {
    if (!item || typeof item !== "object" || seen.has(item)) return undefined;
    seen.add(item);
    const vg = item.videoGeneration || item.video_generation;
    if (vg && typeof vg === "object" && (vg.resultId || vg.result_id || vg.stage)) return vg;
    for (const nested of Object.values(item)) {
      const found = visit(nested);
      if (found) return found;
    }
    return undefined;
  };
  return visit(value);
}

async function uploadLocalFile(ctx, filePath) {
  const abs = resolve(filePath);
  const bytes = await readFile(abs);
  const name = basename(abs);
  const form = new FormData();
  form.append("file", new Blob([bytes]), name);
  form.append("fileName", name);
  const res = await apiRequest({ ...ctx, method: "POST", path: "/v1/files/upload", body: form, timeoutMs: 180_000 });
  const url = extractUrls(res)[0] || res?.data?.url || res?.url;
  if (!url) fail(`Upload succeeded but returned no URL for ${filePath}`, 5, res, ctx.apiKey);
  return { source: abs, url };
}

async function resolveMediaRefs(ctx, items = []) {
  const urls = [];
  for (const item of items) {
    const s = String(item).trim();
    if (!s) continue;
    if (/^https?:\/\//i.test(s)) {
      urls.push(s);
    } else {
      const uploaded = await uploadLocalFile(ctx, s);
      urls.push(uploaded.url);
    }
  }
  return urls;
}

async function pollTask(ctx, taskId, pollIntervalMs = 2000, maxWaitMs = 25 * 60_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    let task;
    try {
      task = await apiRequest({ ...ctx, method: "GET", path: `/v1/ai/result/${encodeURIComponent(taskId)}` });
    } catch {
      task = await apiRequest({ ...ctx, method: "GET", path: `/v1/tasks/${encodeURIComponent(taskId)}` });
    }
    const status = extractStatus(task);
    const urls = extractUrls(task);
    if (TERMINAL_FAIL.has(status)) {
      const errMsg = task?.user_message || task?.message || task?.error || `Task ${taskId} ended with status: ${status}`;
      fail(String(errMsg), 5, { taskId, status, task }, ctx.apiKey);
    }
    if (TERMINAL_OK.has(status) && urls.length > 0) {
      return { taskId, status, urls, task };
    }
    await sleep(pollIntervalMs);
  }
  fail(`Timed out waiting for task ${taskId}. Check later with: node wowidea.mjs status ${taskId}`, 5, { taskId }, ctx.apiKey);
}

async function downloadFiles(urls, outTarget, taskId = "output") {
  if (!urls.length || outTarget === false) return [];
  const rawTarget = String(outTarget || "./wowidea-output");
  const hasFileExt = /\.[a-zA-Z0-9]{2,5}$/.test(rawTarget) && urls.length === 1;
  const saved = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const urlPathName = basename(new URL(url).pathname).replace(/[^a-zA-Z0-9._-]/g, "_") || `file-${i + 1}`;
    let dest;
    if (hasFileExt) {
      dest = resolve(rawTarget);
      await mkdir(dirname(dest), { recursive: true });
    } else {
      const dir = resolve(rawTarget);
      await mkdir(dir, { recursive: true });
      const prefix = urls.length > 1 ? `${taskId}-${i + 1}-` : `${taskId}-`;
      dest = urlPathName.includes(taskId) ? resolve(dir, urlPathName) : resolve(dir, `${prefix}${urlPathName}`);
    }

    let ok = false;
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const part = `${dest}.${randomUUID()}.part`;
      try {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
          if (!res.ok || !res.body) throw new Error(`Download HTTP ${res.status}`);
          await pipeline(Readable.fromWeb(res.body), createWriteStream(part, { flags: "wx", mode: 0o644 }));
        } catch (fetchErr) {
          await unlink(part).catch(() => {});
          const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
          await execFileAsync(curlBin, ["-fsSL", "--max-time", "180", "-o", part, url]);
        }
        const size = (await stat(part)).size;
        if (!size) throw new Error("Downloaded empty file");
        await rename(part, dest);
        saved.push(dest);
        ok = true;
        break;
      } catch (err) {
        lastErr = err;
        await unlink(part).catch(() => {});
        if (attempt < 3) await sleep(500 * attempt);
      }
    }
    if (!ok) fail(`Failed to download ${url}: ${lastErr?.message || lastErr}`, 5, { taskId, urls });
  }
  return saved;
}

function printUsage() {
  console.log(`Usage: node wowidea.mjs <command> [options]

Commands:
  balance                                      Check account points balance
  models [--type image|video|speech|music|text] [--id <modelId>]
                                               List live enabled models or inspect one model's full capabilities
  upload <localFile>                           Upload local image/video/audio and return HTTPS URL
  image --prompt "..." [options]               Generate or edit image, poll, and download locally
  video --prompt "..." [options]               Generate or edit video (or --draft), poll, and download locally
  video-finalize <draftId> [--yes]             Preview or submit 1080p final render from a Seedance 2.5 draft
  speech --text "..." [options]                Synthesize speech (TTS), poll, and download locally
  chat --prompt "..." [options]                Call multimodal / text chat completions
  status <taskId>                              Check async task status and output URLs
  download <taskId> [--out <dirOrFile>]        Download completed task outputs locally
  request <METHOD> <PATH> [--body '{...}']     Raw authenticated API request (add --wait to poll task_id)

Common Options:
  --model <id>          Model ID from 'models' list
  --out <dirOrFile>     Output directory or exact file path (default: ./wowidea-output)
  --ref <pathOrUrl>     Reference image (repeatable; local files auto-upload)
  --body '<json>'       Merge raw JSON fields into request payload
  --body-file <path>    Merge raw JSON file into request payload
  --no-wait             Return immediately after task submission without polling`);
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const cmd = positionals[0];
  if (!cmd || cmd === "help" || flags.help || flags.h) {
    printUsage();
    return;
  }

  const apiKey = resolveApiKey(flags["api-key"]);
  if (!apiKey) {
    fail("WOWIDEA_API_KEY is not configured. Set export WOWIDEA_API_KEY='sk-...' or save it to ~/.config/wowidea/api_key.", 3);
  }
  const baseUrl = canonicalBaseUrl(flags["base-url"]);
  const ctx = { baseUrl, apiKey };

  if (cmd === "balance") {
    const res = await apiRequest({ ...ctx, method: "GET", path: "/v1/balance" });
    console.log(JSON.stringify({ ok: true, balance: res?.data ?? res }, null, 2));
    return;
  }

  if (cmd === "models") {
    const res = await apiRequest({ ...ctx, method: "GET", path: "/v1/models" });
    const rows = Array.isArray(res) ? res : res?.data || res?.items || [];
    if (flags.id) {
      const target = String(flags.id).toLowerCase().trim();
      const found = rows.find((m) => [m.id, m.name, m.modelName, m.modelAlias].some((v) => String(v || "").toLowerCase() === target));
      if (!found) fail(`Model not found: ${flags.id}`, 2, undefined, apiKey);
      const clone = structuredClone(found);
      if (!flags["full-voices"] && Array.isArray(clone?.capabilities?.text_to_speech?.voices)) {
        const voices = clone.capabilities.text_to_speech.voices;
        clone.capabilities.text_to_speech.voices_total = voices.length;
        clone.capabilities.text_to_speech.voices_preview = voices.slice(0, 20).map((v) => ({ id: v.id, name: v.name, gender: v.gender, lang: v.lang, desc: v.desc }));
        delete clone.capabilities.text_to_speech.voices;
      }
      console.log(JSON.stringify({ ok: true, model: clone }, null, 2));
      return;
    }
    const want = flags.type ? String(flags.type).toLowerCase() : "";
    const filtered = rows.filter((m) => {
      if (m.enabled === false) return false;
      if (!want) return true;
      const types = (m.modelType || m.types || []).map((t) => String(t).toLowerCase());
      if (want === "image") return types.includes("image_generate") || types.includes("image_edit");
      if (want === "video") return types.some((t) => ["video_generate", "image_to_video", "omni_video"].includes(t));
      if (want === "speech" || want === "tts") return types.includes("text_to_speech");
      if (want === "music" || want === "audio") return types.includes("audio_generate") || types.includes("text_to_speech");
      if (want === "text" || want === "chat") return types.includes("text_generate");
      return types.includes(want);
    });
    const compact = filtered.map((m) => ({
      id: m.id,
      provider: m.provider,
      types: m.modelType || m.types || [],
      description: m.description || "",
    }));
    console.log(JSON.stringify({ ok: true, count: compact.length, models: compact }, null, 2));
    return;
  }

  if (cmd === "upload") {
    const file = positionals[1] || flags.file;
    if (!file) fail("Usage: node wowidea.mjs upload <localFilePath>", 2, undefined, apiKey);
    const uploaded = await uploadLocalFile(ctx, String(file));
    console.log(JSON.stringify({ ok: true, ...uploaded }, null, 2));
    return;
  }

  if (cmd === "status") {
    const id = positionals[1] || flags.id;
    if (!id) fail("Usage: node wowidea.mjs status <taskId>", 2, undefined, apiKey);
    const task = await apiRequest({ ...ctx, method: "GET", path: `/v1/ai/result/${encodeURIComponent(String(id))}` });
    console.log(JSON.stringify({ ok: true, taskId: String(id), status: extractStatus(task), urls: extractUrls(task), raw: task }, null, 2));
    return;
  }

  if (cmd === "download") {
    const id = positionals[1] || flags.id;
    if (!id) fail("Usage: node wowidea.mjs download <taskId> [--out <dirOrFile>]", 2, undefined, apiKey);
    const task = await apiRequest({ ...ctx, method: "GET", path: `/v1/ai/result/${encodeURIComponent(String(id))}` });
    const urls = extractUrls(task);
    if (!urls.length) fail(`Task ${id} has no downloadable URLs yet (status: ${extractStatus(task)}).`, 2, task, apiKey);
    const files = await downloadFiles(urls, flags.out, String(id));
    console.log(JSON.stringify({ ok: true, taskId: String(id), status: extractStatus(task), urls, files }, null, 2));
    return;
  }

  if (cmd === "image") {
    const payload = await loadJsonBody(flags, apiKey);
    if (flags.prompt) payload.prompt = String(flags.prompt);
    if (!payload.prompt) fail("Image generation requires --prompt \"...\".", 2, undefined, apiKey);
    payload.model = flags.model ? String(flags.model) : payload.model || "Nano Banana 2";
    if (flags.ratio || flags["aspect-ratio"]) payload.aspect_ratio = String(flags.ratio || flags["aspect-ratio"]);
    if (flags.resolution) payload.resolution = String(flags.resolution).toUpperCase() === "1.5K" ? "1.5K" : String(flags.resolution).toUpperCase();
    if (flags.quality) payload.quality = String(flags.quality);
    if (flags.format) payload.output_format = String(flags.format).toLowerCase();
    if (flags.background) payload.background = String(flags.background).toLowerCase();
    payload.n ??= 1;

    const refs = await resolveMediaRefs(ctx, flags.ref || []);
    if (refs.length) payload.image = refs;
    else if (Array.isArray(payload.image_urls)) {
      payload.image = await resolveMediaRefs(ctx, payload.image_urls);
      delete payload.image_urls;
    }

    const idempotencyKey = flags["idempotency-key"] ? String(flags["idempotency-key"]) : randomUUID();
    const submitted = await apiRequest({
      ...ctx,
      method: "POST",
      path: "/v1/images/generations",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey, "x-async": "true" },
      timeoutMs: 300_000,
    });
    const taskId = extractTaskId(submitted);
    const immediateUrls = extractUrls(submitted);
    if (flags.wait === false) {
      console.log(JSON.stringify({ ok: true, submitted: true, taskId, model: payload.model, urls: immediateUrls, raw: submitted }, null, 2));
      return;
    }
    if (!taskId && immediateUrls.length) {
      const files = await downloadFiles(immediateUrls, flags.out, "image");
      console.log(JSON.stringify({ ok: true, taskId: null, model: payload.model, status: "success", urls: immediateUrls, files }, null, 2));
      return;
    }
    if (!taskId) fail("Image submission returned neither taskId nor image URLs.", 5, submitted, apiKey);
    const completed = await pollTask(ctx, taskId);
    const files = await downloadFiles(completed.urls, flags.out, taskId);
    console.log(JSON.stringify({ ok: true, taskId, model: payload.model, status: completed.status, urls: completed.urls, files }, null, 2));
    return;
  }

  if (cmd === "video") {
    let payload = await loadJsonBody(flags, apiKey);
    if (flags.prompt) payload.prompt = String(flags.prompt);
    const rawModel = flags.model ? String(flags.model) : String(payload.model || "豆包Seedance-2.5");
    if (/^Seedance-2\.5-Final$/i.test(rawModel)) {
      fail("Seedance-2.5-Final cannot be generated from a prompt. Generate a draft first (--draft), then run: node wowidea.mjs video-finalize <draftTaskId> --yes", 2);
    }
    const isDraft = Boolean(flags.draft || payload.draft === true || /^Seedance-2\.5-Draft$/i.test(rawModel));
    payload.model = /^Seedance-2\.5-Draft$/i.test(rawModel) ? "豆包Seedance-2.5" : rawModel;

    const imageRefs = await resolveMediaRefs(ctx, flags.ref || payload.image_urls || []);
    const videoRefs = await resolveMediaRefs(ctx, flags["video-ref"] || payload.video_urls || []);
    const audioRefs = await resolveMediaRefs(ctx, flags["audio-ref"] || payload.audio_urls || []);
    if (imageRefs.length) payload.image_urls = imageRefs;
    if (videoRefs.length) payload.video_urls = videoRefs;
    if (audioRefs.length) payload.audio_urls = audioRefs;

    if (flags.mode) payload.mode = String(flags.mode);
    else if (!payload.mode) {
      payload.mode = videoRefs.length ? "video_reference" : imageRefs.length ? "image_reference" : "text_to_video";
    }

    payload.duration = Number(flags.duration ?? payload.duration ?? (isDraft ? 4 : 5));
    payload.aspect_ratio = String(flags.ratio || flags["aspect-ratio"] || payload.aspect_ratio || (payload.mode === "first_last_frame" ? "adaptive" : "16:9"));
    payload.resolution = String(flags.resolution || payload.resolution || (isDraft ? "480p" : "720p"));
    payload.audio = flags.audio !== undefined ? Boolean(flags.audio) : (payload.audio ?? false);
    payload.watermark = false;

    if (!payload.content && payload.prompt) {
      const content = [{ type: "text", text: String(payload.prompt) }];
      if (payload.mode === "first_last_frame") {
        if (imageRefs[0]) content.push({ type: "image_url", role: "first_frame", image_url: { url: imageRefs[0] } });
        if (imageRefs[1]) content.push({ type: "image_url", role: "last_frame", image_url: { url: imageRefs[1] } });
      } else {
        for (const url of imageRefs) {
          content.push({ type: "image_url", role: isDraft ? "first_frame" : "reference_image", image_url: { url } });
        }
      }
      payload.content = content;
    }

    if (isDraft && payload.model === "豆包Seedance-2.5") {
      if (payload.resolution !== "480p") fail("Seedance 2.5 draft requires --resolution 480p.", 2);
      payload = {
        model: "豆包Seedance-2.5",
        content: payload.content,
        draft: true,
        resolution: "480p",
        duration: payload.duration,
        aspect_ratio: payload.aspect_ratio,
        audio: payload.audio,
      };
    }

    const idempotencyKey = flags["idempotency-key"] ? String(flags["idempotency-key"]) : randomUUID();
    const submitted = await apiRequest({
      ...ctx,
      method: "POST",
      path: "/v1/video/generations",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey, "x-async": "true" },
      timeoutMs: 360_000,
    });
    const taskId = extractTaskId(submitted);
    if (!taskId) fail("Video submission returned no taskId.", 5, submitted, apiKey);
    if (flags.wait === false) {
      console.log(JSON.stringify({ ok: true, submitted: true, taskId, model: payload.model, draft: isDraft, raw: submitted }, null, 2));
      return;
    }
    const completed = await pollTask(ctx, taskId);
    const vg = findVideoGeneration(completed.task);
    const sourceResultId = vg?.resultId || vg?.result_id || (isDraft ? `${taskId}:0` : undefined);
    const files = await downloadFiles(completed.urls, flags.out, taskId);
    console.log(JSON.stringify({
      ok: true,
      taskId,
      ...(sourceResultId ? { sourceResultId } : {}),
      model: payload.model,
      draft: isDraft,
      status: completed.status,
      urls: completed.urls,
      files,
    }, null, 2));
    return;
  }

  if (cmd === "video-finalize") {
    const draftId = positionals[1] || flags.id;
    if (!draftId) fail("Usage: node wowidea.mjs video-finalize <draftTaskId> [--yes]", 2);
    const taskKey = String(draftId).split(":")[0];
    let task;
    try { task = await apiRequest({ ...ctx, method: "GET", path: `/v1/ai/result/${encodeURIComponent(taskKey)}` }); } catch { /* ignore */ }
    const vg = findVideoGeneration(task);
    const sourceResultId = String(vg?.resultId || vg?.result_id || (String(draftId).includes(":") ? draftId : `${taskKey}:0`));
    const previewRes = await apiRequest({ ...ctx, method: "GET", path: `/v1/video/results/${encodeURIComponent(sourceResultId)}/finalization` });
    const preview = previewRes?.data && !Array.isArray(previewRes.data) ? previewRes.data : previewRes;
    const existingTaskId = preview?.existingTaskId || "";

    if (!flags.yes) {
      console.log(JSON.stringify({
        ok: true,
        submitted: false,
        eligible: preview?.eligible !== false,
        sourceResultId,
        targetResolution: "1080p",
        existingTaskId: existingTaskId || null,
        preview,
        nextStep: `Confirm with user, then run: node wowidea.mjs video-finalize ${draftId} --yes`,
      }, null, 2));
      return;
    }

    let finalTaskId = existingTaskId;
    if (!finalTaskId) {
      if (preview?.eligible === false) fail(preview?.reason || "Draft is not eligible for 1080p finalization.", 2, preview, apiKey);
      const idempotencyKey = flags["idempotency-key"] ? String(flags["idempotency-key"]) : randomUUID();
      const createdRes = await apiRequest({
        ...ctx,
        method: "POST",
        path: "/v1/video/finalizations",
        body: {
          sourceResultId,
          targetResolution: "1080p",
          outputFormat: "mp4",
          watermark: false,
          returnLastFrame: false,
          idempotencyKey,
        },
        headers: { "Idempotency-Key": idempotencyKey, "x-async": "true" },
      });
      const created = createdRes?.data && !Array.isArray(createdRes.data) ? createdRes.data : createdRes;
      finalTaskId = extractTaskId(created);
      if (!finalTaskId) fail("Finalization returned no taskId.", 5, createdRes, apiKey);
    }

    if (flags.wait === false) {
      console.log(JSON.stringify({ ok: true, submitted: true, taskId: finalTaskId, sourceResultId }, null, 2));
      return;
    }
    const completed = await pollTask(ctx, finalTaskId);
    const files = await downloadFiles(completed.urls, flags.out, finalTaskId);
    console.log(JSON.stringify({ ok: true, taskId: finalTaskId, sourceResultId, status: completed.status, urls: completed.urls, files }, null, 2));
    return;
  }

  if (cmd === "speech" || cmd === "tts") {
    const payload = await loadJsonBody(flags, apiKey);
    const text = flags.text ?? flags.prompt ?? payload.text;
    if (!text || !String(text).trim()) fail("Speech synthesis requires --text \"...\".", 2);
    payload.text = String(text).trim();
    payload.model = flags.model ? String(flags.model) : payload.model || "MiniMax-Speech-2.8-HD";
    payload.voice_id = flags.voice || flags["voice-id"] || payload.voice_id || "male-qn-qingse";
    if (flags.speed !== undefined) payload.speed = Number(flags.speed);
    if (flags.vol !== undefined) payload.vol = Number(flags.vol);
    if (flags.pitch !== undefined) payload.pitch = Number(flags.pitch);
    if (flags.emotion) payload.emotion = String(flags.emotion);
    if (flags.format) payload.format = String(flags.format).toLowerCase();

    const idempotencyKey = flags["idempotency-key"] ? String(flags["idempotency-key"]) : randomUUID();
    const submitted = await apiRequest({
      ...ctx,
      method: "POST",
      path: "/v1/speech/generations",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey, "x-async": "true" },
    });
    const taskId = extractTaskId(submitted);
    const immediateUrls = extractUrls(submitted);
    if (flags.wait === false) {
      console.log(JSON.stringify({ ok: true, submitted: true, taskId, model: payload.model, raw: submitted }, null, 2));
      return;
    }
    if (!taskId && immediateUrls.length) {
      const files = await downloadFiles(immediateUrls, flags.out, "speech");
      console.log(JSON.stringify({ ok: true, taskId: null, model: payload.model, status: "success", urls: immediateUrls, files }, null, 2));
      return;
    }
    if (!taskId) fail("Speech submission returned no taskId.", 5, submitted, apiKey);
    const completed = await pollTask(ctx, taskId);
    const files = await downloadFiles(completed.urls, flags.out, taskId);
    console.log(JSON.stringify({ ok: true, taskId, model: payload.model, voice_id: payload.voice_id, status: completed.status, urls: completed.urls, files }, null, 2));
    return;
  }

  if (cmd === "chat") {
    const payload = await loadJsonBody(flags, apiKey);
    payload.model = flags.model ? String(flags.model) : payload.model || "Qwen3.8-Max";
    if (!payload.messages) {
      const prompt = flags.prompt || positionals[1];
      if (!prompt) fail("Chat requires --prompt \"...\" or --body with messages.", 2);
      const imageUrls = await resolveMediaRefs(ctx, flags.image || flags.ref || []);
      const userContent = imageUrls.length
        ? [{ type: "text", text: String(prompt) }, ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } }))]
        : String(prompt);
      payload.messages = [
        ...(flags.system ? [{ role: "system", content: String(flags.system) }] : []),
        { role: "user", content: userContent },
      ];
    }
    const res = await apiRequest({ ...ctx, method: "POST", path: "/v1/chat/completions", body: payload, timeoutMs: 180_000 });
    const text = res?.choices?.[0]?.message?.content ?? null;
    console.log(JSON.stringify({ ok: true, model: payload.model, content: text, raw: res }, null, 2));
    return;
  }

  if (cmd === "request") {
    const method = (positionals[1] || "GET").toUpperCase();
    const path = positionals[2];
    if (!path) fail("Usage: node wowidea.mjs request <METHOD> <PATH> [--body '{...}'] [--wait] [--out <dir>]", 2);
    const hasBody = Boolean(flags.body || flags["body-file"]);
    const body = hasBody ? await loadJsonBody(flags, apiKey) : undefined;
    const res = await apiRequest({ ...ctx, method, path, body, timeoutMs: 300_000 });
    const taskId = extractTaskId(res);
    if (flags.wait && taskId) {
      const completed = await pollTask(ctx, taskId);
      const files = flags.out ? await downloadFiles(completed.urls, flags.out, taskId) : [];
      console.log(JSON.stringify({ ok: true, taskId, status: completed.status, urls: completed.urls, files, raw: completed.task }, null, 2));
      return;
    }
    console.log(JSON.stringify({ ok: true, response: res }, null, 2));
    return;
  }

  fail(`Unknown command: ${cmd}. Run 'node wowidea.mjs --help' for usage.`, 2);
}

main().catch((err) => fail(err?.message || String(err), 5));
