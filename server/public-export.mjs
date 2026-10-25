import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { validateState } from "./store.mjs";
import { musicTracks } from "../shared/music.js";
import { readerPath } from "../shared/reader-links.js";
const exportProblem = (message) =>
  Object.assign(new Error(message), { publicMessage: message });

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/mpeg": ".mp3",
  "audio/flac": ".flac",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
export function siteOrigin(value) {
  if (!value) return "";
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw exportProblem("分享地址必须是 HTTPS 网站首页地址");
  return url.origin;
}

export function socialHtml(
  template,
  { origin, route, title, description, image },
) {
  const absolute = (value) => (origin ? new URL(value, origin).href : "");
  const tags = {
    "og:type": "website",
    "og:site_name": "XGN",
    "og:locale": "zh_CN",
    "og:title": title,
    "og:description": description,
    ...(origin ? { "og:url": absolute(route) } : {}),
    ...(image && origin ? { "og:image": absolute(image) } : {}),
  };
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${escape(description)}" />`,
    )
    .replace(
      "</head>",
      `${Object.entries(tags)
        .map(
          ([property, value]) =>
            `<meta property="${property}" content="${escape(value)}" />`,
        )
        .join(
          "\n",
        )}\n<meta name="twitter:card" content="${image && origin ? "summary_large_image" : "summary"}" />\n${origin ? `<link rel="canonical" href="${escape(absolute(route))}" />` : ""}\n</head>`,
    );
}

// Read a consistent published snapshot only. Never open through openStore(),
// which performs migrations and therefore requires write access.
export function readPublishedSnapshot(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    db.exec("BEGIN");
    const row = db
      .prepare("SELECT body,revision FROM state WHERE id='published'")
      .get();
    if (!row) throw exportProblem("找不到已发布版本，请先在编辑台保存发布");
    const data = validateState(JSON.parse(row.body));
    const media = new Map();
    const rewrite = (src, kind) => {
      if (!src || src === "/assets/edgerunners.jpg") return src;
      const id = /^\/media\/([a-f0-9]{32})$/.exec(src)?.[1];
      if (!id) throw exportProblem("公开内容包含无效的媒体地址");
      const file = db
        .prepare("SELECT mime,bytes FROM media WHERE id=?")
        .get(id);
      if (!file || !file.mime.startsWith(kind) || !extensions[file.mime])
        throw exportProblem("公开海报或音乐缺失，请在编辑台重新上传");
      if (file.bytes.length > 25 * 1024 * 1024)
        throw exportProblem(
          "免费托管单文件不能超过 25 MiB，请压缩过大的音乐后重新上传",
        );
      const target = `/media/${id}${extensions[file.mime]}`;
      media.set(target, Buffer.from(file.bytes));
      return target;
    };
    for (const year of data.years)
      for (const entry of year.entries)
        entry.image = rewrite(entry.image, "image/");
    if (data.music)
      data.music = {
        tracks: musicTracks(data.music).map((track) => ({
          ...track,
          src: rewrite(track.src, "audio/"),
        })),
      };
    return { data, revision: row.revision, media };
  } finally {
    db.close();
  }
}

export async function writePublicSnapshot({ dbPath, outDir, origin = "" }) {
  origin = siteOrigin(origin);
  const template = await readFile(path.join(outDir, "index.html"), "utf8");
  const snapshot = readPublishedSnapshot(dbPath);
  const write = async (name, bytes) => {
    const file = path.join(outDir, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  };
  for (const [src, bytes] of snapshot.media) await write(src.slice(1), bytes);
  await write(
    "content.json",
    JSON.stringify({ data: snapshot.data, revision: snapshot.revision }),
  );
  const years = [...snapshot.data.years].sort((a, b) =>
    b.id.localeCompare(a.id),
  );
  const description = "按年份收藏作品、剧情片段与留在心里的瞬间。";
  const hero = (year) =>
    year?.entries.find((e) => !e.nominee) || year?.entries[0];
  const html = (route, title, entry) =>
    socialHtml(template, {
      origin,
      route,
      title,
      description: entry?.spoiler
        ? "颁奖词含剧透，打开后选择阅读。"
        : (entry?.teaser || entry?.review || description).slice(0, 160),
      image: entry?.image,
    });
  await write(
    "index.html",
    html("/", "XGN · 年度档案"),
  );
  await write("404.html", html("/", "XGN · 我的文娱年度评选"));
  for (const year of years) {
    const route = readerPath(year.id);
    await write(
      `${route.slice(1)}index.html`,
      html(route, `XGN ${year.id} · 年度评选`, hero(year)),
    );
    for (const entry of year.entries) {
      const entryRoute = readerPath(year.id, entry.id);
      await write(
        `${entryRoute.slice(1)}index.html`,
        html(
          entryRoute,
          `${entry.title} · ${year.id} ${entry.award} · XGN`,
          entry,
        ),
      );
    }
  }
  await write("_redirects", "/edit / 302\n/preview / 302\n");
  await write(
    "_headers",
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n/media/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
  );
  const files = await checkPublicLimits(outDir);
  return {
    revision: snapshot.revision,
    years: years.length,
    entries: years.reduce((n, y) => n + y.entries.length, 0),
    media: snapshot.media.size,
    ...files,
  };
}

export async function checkPublicLimits(dir) {
  let files = 0,
    bytes = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw exportProblem("公开包不能包含符号链接");
    if (item.isDirectory()) {
      const children = await checkPublicLimits(file);
      files += children.files;
      bytes += children.bytes;
    } else {
      const size = (await stat(file)).size;
      if (size > 25 * 1024 * 1024)
        throw exportProblem(`公开文件超过 25 MiB：${item.name}`);
      files++;
      bytes += size;
    }
  }
  if (files > 20000)
    throw exportProblem("公开包超过免费托管的 20,000 个文件限制");
  return { files, bytes };
}
