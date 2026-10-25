import { randomBytes } from "node:crypto";
import path from "node:path";
import { openStore, validateState, fail } from "./store.mjs";
import { musicTracks } from "../shared/music.js";

export function detectImage(bytes) {
  if (bytes.length < 12) fail("图片文件无效");
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a")
    return "image/png";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return "image/gif";
  fail("支持 JPG、PNG、WebP、GIF 图片");
}
export function detectAudio(bytes) {
  if (bytes.length < 12) fail("音频文件无效");
  if (
    bytes.subarray(0, 3).toString() === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0)
  )
    return "audio/mpeg";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WAVE"
  )
    return "audio/wav";
  if (bytes.subarray(0, 4).toString() === "OggS") return "audio/ogg";
  if (bytes.subarray(0, 4).toString() === "fLaC") return "audio/flac";
  if (bytes.subarray(4, 8).toString() === "ftyp") return "audio/mp4";
  fail("支持 MP3、FLAC、M4A、WAV、OGG 音频");
}
async function body(req, limit = 8 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail("文件或数据过大", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function jsonBody(req, limit) {
  try {
    return JSON.parse((await body(req, limit)).toString());
  } catch (e) {
    if (e.status) throw e;
    fail("JSON 数据无效");
  }
}
const referenced = (state, id) =>
  musicTracks(state.music).some((track) => track.src === `/media/${id}`) ||
  state.years.some(
    (y) =>
      y.music?.src === `/media/${id}` ||
      y.entries.some((e) => e.image === `/media/${id}`),
  );

function mediaReferences(state) {
  return [
    ...state.years
      .flatMap((year) => year.entries)
      .filter((e) => e.image.startsWith("/media/"))
      .map((e) => ({ src: e.image, kind: "image/" })),
    ...musicTracks(state.music).map((track) => ({
      src: track.src,
      kind: "audio/",
    })),
  ];
}

export function createApi({
  dir = process.env.XGN_DATA_DIR || path.resolve("data"),
  publisher = null,
} = {}) {
  const store = openStore(dir);
  const attempts = new Map();
  return {
    store,
    async handle(
      req,
      res,
      next = () => {
        res.statusCode = 404;
        res.end();
      },
    ) {
      const secure = process.env.XGN_SECURE_COOKIE === "1";
      const url = new URL(
        req.url,
        `${secure ? "https" : "http"}://${req.headers.host || "localhost"}`,
      );
      if (
        !url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/media/")
      )
        return next();
      const token = /(?:^|;\s*)xgn_session=([a-f0-9]{64})/.exec(
        req.headers.cookie || "",
      )?.[1];
      const authed = store.authenticated(token);
      const local =
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          req.socket.remoteAddress,
        ) &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
        !req.headers["x-forwarded-for"];
      const cookie = (value) =>
        `xgn_session=${value}; HttpOnly; SameSite=Strict; Path=/; ${secure ? "Secure; " : ""}Max-Age=${value ? 604800 : 0}`;
      const hostingAfterPublish = () =>
        !publisher
          ? undefined
          : local
            ? publisher.start()
            : {
                ...publisher.status(),
                state: "local-only",
                message:
                  "已保存公开版本；请通过本机 127.0.0.1 地址打开编辑台，更新分享网站。",
              };
      const send = (status, value) => {
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(value));
      };
      try {
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (!["GET", "HEAD"].includes(req.method)) {
          if (req.headers.origin && req.headers.origin !== url.origin)
            fail("请求来源不匹配", 403);
          if (req.headers["sec-fetch-site"] === "cross-site")
            fail("跨站请求被拒绝", 403);
        }
        const route = `${req.method} ${url.pathname}`;
        if (route === "GET /api/session")
          return send(200, {
            authenticated: authed,
            setup: !store.ownerExists(),
            canSetup: local,
          });
        if (route === "GET /api/public")
          return send(200, store.read("published"));
        if (route === "POST /api/setup" || route === "POST /api/login") {
          const ip = req.socket.remoteAddress;
          const attempt = attempts.get(ip) || {
            n: 0,
            until: Date.now() + 600000,
          };
          if (attempt.until < Date.now()) {
            attempt.n = 0;
            attempt.until = Date.now() + 600000;
          }
          if (attempt.n >= 12) fail("尝试次数较多，请十分钟后重试", 429);
          const data = await jsonBody(req, 4096);
          if (route.endsWith("/setup")) {
            if (store.ownerExists()) fail("已完成初始化", 409);
            if (!local)
              fail(
                "请在服务器本机初始化，或设置 XGN_ADMIN_PASSWORD 后重启",
                403,
              );
            store.setPassword(data.password);
          } else if (!store.verify(data.password)) {
            attempt.n++;
            attempts.set(ip, attempt);
            fail("密码不正确", 401);
          }
          attempts.delete(ip);
          res.setHeader("Set-Cookie", cookie(store.session()));
          return send(200, { ok: true });
        }
        if (
          url.pathname.startsWith("/media/") &&
          ["GET", "HEAD"].includes(req.method)
        ) {
          const id = url.pathname.slice(7);
          if (!/^[a-f0-9]{32}$/.test(id)) fail("图片不存在", 404);
          if (!authed && !referenced(store.read("published").data, id))
            fail("图片不存在", 404);
          const image = store.db
            .prepare("SELECT mime,bytes FROM media WHERE id=?")
            .get(id);
          if (!image) fail("图片不存在", 404);
          res.setHeader("Content-Type", image.mime);
          res.setHeader("Cache-Control", "private, max-age=3600");
          res.setHeader("Accept-Ranges", "bytes");
          const size = image.bytes.length;
          if (req.headers.range) {
            const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
            let start = range?.[1] ? Number(range[1]) : 0;
            let end = range?.[2] ? Number(range[2]) : size - 1;
            if (range && !range[1] && range[2]) {
              start = Math.max(0, size - end);
              end = size - 1;
            }
            if (
              !range ||
              (!range[1] && !range[2]) ||
              !Number.isSafeInteger(start) ||
              !Number.isSafeInteger(end) ||
              start >= size ||
              start > end ||
              end < 0
            ) {
              res.writeHead(416, { "Content-Range": `bytes */${size}` });
              return res.end();
            }
            end = Math.min(end, size - 1);
            res.writeHead(206, {
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Content-Length": end - start + 1,
            });
            return res.end(
              req.method === "HEAD"
                ? undefined
                : image.bytes.subarray(start, end + 1),
            );
          }
          res.setHeader("Content-Length", size);
          res.statusCode = 200;
          return res.end(req.method === "HEAD" ? undefined : image.bytes);
        }
        if (!authed) fail("请先登录编辑台", 401);
        if (route === "GET /api/hosting")
          return send(200, publisher?.status() || { state: "unconnected" });
        if (route === "POST /api/deploy") {
          if (!local) fail("请在本机编辑台发布分享网站", 403);
          return send(200, publisher?.start() || { state: "unconnected" });
        }
        if (route === "POST /api/logout") {
          store.revoke(token);
          res.setHeader("Set-Cookie", cookie(""));
          return send(200, { ok: true });
        }
        if (route === "GET /api/draft")
          return send(200, {
            ...store.read("draft"),
            published: store.read("published").data.years,
          });
        if (route === "PUT /api/draft") {
          const input = await jsonBody(req);
          const data = validateState(input.data);
          if (input.revision !== store.read("draft").revision)
            fail("草稿已在其他窗口修改，请备份当前内容后重新加载", 409);
          for (const ref of mediaReferences(data)) {
            const media = store.db
              .prepare("SELECT mime FROM media WHERE id=?")
              .get(ref.src.slice(7));
            if (!media || !media.mime.startsWith(ref.kind))
              fail("海报或配乐不存在或格式不符，请重新上传");
          }
          return send(200, store.write("draft", data));
        }
        if (route === "POST /api/publish") {
          const input = await jsonBody(req, 4096);
          if (input.revision !== store.read("draft").revision)
            fail("请先保存最新草稿", 409);
          const target =
            Array.isArray(input.years) && input.years.length
              ? input.years
              : input.year;
          const result = store.publish(target);
          return send(200, { ...result, hosting: hostingAfterPublish() });
        }
        if (route === "POST /api/publish-music") {
          const input = await jsonBody(req, 4096);
          if (input.revision !== store.read("draft").revision)
            fail("请先保存最新修改", 409);
          const result = store.publishMusic();
          return send(200, { ...result, hosting: hostingAfterPublish() });
        }
        if (route === "POST /api/unpublish") {
          const input = await jsonBody(req, 4096);
          const result = store.unpublish(input.year);
          return send(200, { ...result, hosting: hostingAfterPublish() });
        }
        if (route === "POST /api/upload") {
          const bytes = await body(req, 12 * 1024 * 1024);
          const mime = detectImage(bytes);
          const id = randomBytes(16).toString("hex");
          store.db
            .prepare("INSERT INTO media VALUES(?,?,?,?)")
            .run(id, mime, bytes, Date.now());
          return send(201, { image: `/media/${id}` });
        }
        if (route === "POST /api/audio") {
          const bytes = await body(req, 30 * 1024 * 1024);
          const mime = detectAudio(bytes);
          const id = randomBytes(16).toString("hex");
          store.db
            .prepare("INSERT INTO media VALUES(?,?,?,?)")
            .run(id, mime, bytes, Date.now());
          return send(201, { src: `/media/${id}` });
        }
        if (route === "GET /api/backup") {
          const draft = store.read("draft").data;
          const published = store.read("published").data;
          const media = store.db
            .prepare("SELECT id,mime,bytes FROM media")
            .all()
            .filter(
              (media) =>
                referenced(draft, media.id) || referenced(published, media.id),
            )
            .map((r) => ({
              id: r.id,
              mime: r.mime,
              base64: Buffer.from(r.bytes).toString("base64"),
            }));
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="xgn-backup.json"',
          );
          return send(200, {
            format: "xgn-backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            draft,
            published,
            media,
          });
        }
        if (route === "POST /api/restore") {
          const input = await jsonBody(req, 200 * 1024 * 1024);
          if (
            input.format !== "xgn-backup" ||
            input.version !== 1 ||
            !Array.isArray(input.media)
          )
            fail("不是受支持的 XGN 备份");
          const draft = validateState(input.draft),
            published = validateState(input.published);
          const media = input.media.map((m) => {
            if (!/^[a-f0-9]{32}$/.test(m.id) || typeof m.base64 !== "string")
              fail("备份图片数据无效");
            const bytes = Buffer.from(m.base64, "base64");
            if (
              bytes.length >
                (m.mime?.startsWith("audio/") ? 30 : 12) * 1024 * 1024 ||
              (m.mime?.startsWith("audio/")
                ? detectAudio(bytes)
                : detectImage(bytes)) !== m.mime
            )
              fail("备份图片无效");
            return { ...m, bytes };
          });
          const ids = new Set(media.map((m) => m.id));
          for (const state of [draft, published])
            for (const ref of mediaReferences(state))
              if (
                !ids.has(ref.src.slice(7)) ||
                !media
                  .find((m) => m.id === ref.src.slice(7))
                  .mime.startsWith(ref.kind)
              )
                fail("备份缺少海报或配乐，或格式不符");
          // A restore point contains content only; credentials and sessions never enter a backup.
          store.db.exec("BEGIN IMMEDIATE");
          try {
            const previous = {
              draft: store.read("draft").data,
              published: store.read("published").data,
            };
            store.db.exec(
              "CREATE TABLE IF NOT EXISTS restore_point(id INTEGER PRIMARY KEY CHECK(id=1), body TEXT)",
            );
            store.db
              .prepare("INSERT OR REPLACE INTO restore_point VALUES(1,?)")
              .run(JSON.stringify(previous));
            for (const m of media)
              store.db
                .prepare("INSERT OR IGNORE INTO media VALUES(?,?,?,?)")
                .run(m.id, m.mime, m.bytes, Date.now());
            store.write("draft", draft);
            store.write("published", published);
            store.db.exec("COMMIT");
          } catch (e) {
            store.db.exec("ROLLBACK");
            throw e;
          }
          return send(200, { ok: true });
        }
        if (route === "POST /api/undo-restore") {
          let point;
          try {
            point = store.db
              .prepare("SELECT body FROM restore_point WHERE id=1")
              .get();
          } catch {
            /* no restore yet */
          }
          if (!point) fail("没有可撤销的恢复");
          const previous = JSON.parse(point.body);
          store.db.exec("BEGIN IMMEDIATE");
          try {
            store.write("draft", previous.draft);
            store.write("published", previous.published);
            store.db.prepare("DELETE FROM restore_point").run();
            store.db.exec("COMMIT");
          } catch (e) {
            store.db.exec("ROLLBACK");
            throw e;
          }
          return send(200, { ok: true });
        }
        fail("接口不存在", 404);
      } catch (e) {
        if (!res.writableEnded)
          send(e.status || 500, {
            error: e.status ? e.message : "服务暂时出错，请重试",
          });
        if (!e.status) console.error(e);
      }
    },
  };
}
