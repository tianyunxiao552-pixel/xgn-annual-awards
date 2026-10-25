export { musicTracks, pickInitialTrackIndex } from "../shared/music.js";
import { readerPath } from "../shared/reader-links.js";
export { readerTarget } from "../shared/reader-links.js";
export const publicSite = import.meta.env?.VITE_XGN_PUBLIC === true;
export async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(typeof options.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "服务器响应无效，请重试"
        : `请求失败（${response.status}），请重试`,
    );
  }
  if (!response.ok)
    throw Object.assign(new Error(value.error || "请求未完成"), {
      status: response.status,
    });
  return value;
}
export function navigatePage(url) {
  history.pushState({}, "", url);
  window.dispatchEvent(new Event("xgn:navigate"));
}
export function refreshPublished() {
  window.dispatchEvent(new Event("xgn:published"));
}
export const send = (url, data, method = "POST") =>
  api(url, { method, body: JSON.stringify(data) });
export {
  DEFAULT_AWARDS,
  MORE_AWARDS,
  orderedAwards,
  isCollectionAward,
} from "../shared/awards.js";
export function newEntry(award) {
  return {
    id: crypto.randomUUID(),
    award,
    title: "",
    source: "",
    scope: "",
    score: null,
    teaser: "",
    review: "",
    image: "",
    accent: "#ff0054",
    x: 50,
    y: 50,
    fit: "cover",
    spoiler: false,
    nominee: false,
  };
}
export function paletteFromPixels(pixels) {
  const buckets = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]],
      max = Math.max(...rgb),
      min = Math.min(...rgb);
    if (max < 55 || min > 205 || max - min < 45) continue;
    const key = rgb.map((c) => Math.round(c / 32)).join(",");
    const old = buckets.get(key) || { weight: 0, rgb: [0, 0, 0], n: 0 };
    old.weight += (max - min) / max;
    old.n++;
    rgb.forEach((c, j) => (old.rgb[j] += c));
    buckets.set(key, old);
  }
  const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best) return "#d5c5a6";
  const rgb = best.rgb.map((c) => c / best.n),
    max = Math.max(...rgb),
    boost = Math.max(1, 220 / max);
  return (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.min(255, c * boost))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export async function preparePoster(file) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("请选择 JPG、PNG、WebP 或 GIF 图片");
  if (file.size > 30 * 1024 * 1024) throw new Error("图片请小于 30 MB");
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas"),
      scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const sample = document.createElement("canvas");
    sample.width = sample.height = 80;
    const sctx = sample.getContext("2d");
    sctx.drawImage(bitmap, 0, 0, 80, 80);
    const accent = paletteFromPixels(sctx.getImageData(0, 0, 80, 80).data);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob) throw new Error("图片处理失败，请换一张图片");
    return { blob, accent };
  } finally {
    bitmap.close();
  }
}
export function publicLink(year, entry) {
  if (publicSite)
    return new URL(readerPath(year, entry), window.location.origin).href;
  const url = new URL("/", window.location.origin);
  url.searchParams.set("year", year);
  if (entry) url.searchParams.set("entry", entry);
  return url.href;
}
