import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  readPublishedSnapshot,
  writePublicSnapshot,
  socialHtml,
  siteOrigin,
} from "../server/public-export.mjs";
import {
  createPublisher,
  publishingConfig,
  savedProjectName,
} from "../server/publishing.mjs";
import { readerTarget, readerPath } from "../shared/reader-links.js";
import { createApi } from "../server/api.mjs";
import { createServer } from "node:http";

const imageId = "a".repeat(32),
  audioId = "b".repeat(32),
  privateId = "c".repeat(32);
const template =
  '<html><head><title>XGN</title><meta name="description" content="old" /></head><body><div id="root"></div></body></html>';
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "xgn-public-"));
  const outDir = path.join(dir, "public");
  mkdirSync(outDir);
  writeFileSync(path.join(outDir, "index.html"), template);
  const dbPath = path.join(dir, "xgn.sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(
    "CREATE TABLE state(id TEXT PRIMARY KEY,body TEXT,revision INTEGER); CREATE TABLE media(id TEXT PRIMARY KEY,mime TEXT,bytes BLOB,created INTEGER); CREATE TABLE owner(secret TEXT); CREATE TABLE sessions(token TEXT);",
  );
  const data = {
    years: [
      {
        id: "2025",
        awards: ["年度最爱", "年度遗珠"],
        collectionAward: "年度遗珠",
        entries: [
          {
            id: "my-entry",
            award: "年度最爱",
            title: '公开作品 <&"',
            score: 0,
            image: `/media/${imageId}`,
            accent: "#61c8e2",
            review: "剧透秘密",
            teaser: "剧透秘密",
            spoiler: true,
            posterFraming: {
              desktop: { x: 23, y: 63, zoom: 1.2, fit: "cover" },
              mobile: { x: 71, y: 32, zoom: 1.35, fit: "contain" },
            },
          },
        ],
      },
    ],
    music: { tracks: [{ src: `/media/${audioId}`, title: "公开音乐" }] },
  };
  db.prepare("INSERT INTO state VALUES(?,?,?)").run(
    "published",
    JSON.stringify(data),
    7,
  );
  const draft = structuredClone(data);
  draft.years[0].entries[0].title = "DRAFT_MUST_NOT_LEAK";
  draft.years[0].entries[0].image = `/media/${privateId}`;
  db.prepare("INSERT INTO state VALUES(?,?,?)").run(
    "draft",
    JSON.stringify(draft),
    9,
  );
  db.exec(
    "INSERT INTO owner VALUES('PASSWORD_MUST_NOT_LEAK'); INSERT INTO sessions VALUES('SESSION_MUST_NOT_LEAK');",
  );
  const insert = db.prepare("INSERT INTO media VALUES(?,?,?,0)");
  insert.run(imageId, "image/webp", Buffer.from("published poster"));
  insert.run(audioId, "audio/mpeg", Buffer.from("published audio"));
  insert.run(
    privateId,
    "image/webp",
    Buffer.from("PRIVATE_MEDIA_MUST_NOT_LEAK"),
  );
  db.close();
  return { dir, outDir, dbPath, data };
}
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const allFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory()
      ? allFiles(path.join(dir, item.name))
      : [path.join(dir, item.name)],
  );

test("export only published entries and referenced media; source database stays byte-identical", async () => {
  const f = fixture(),
    before = hash(f.dbPath);
  const report = await writePublicSnapshot({
    ...f,
    origin: "https://example.pages.dev",
  });
  assert.equal(hash(f.dbPath), before);
  assert.equal(report.revision, 7);
  assert.equal(report.media, 2);
  const content = JSON.parse(readFileSync(path.join(f.outDir, "content.json")));
  assert.equal(content.data.years[0].entries[0].score, 0);
  assert.deepEqual(
    content.data.years[0].entries[0].posterFraming,
    f.data.years[0].entries[0].posterFraming,
  );
  assert.equal(content.data.years[0].collectionAward, "年度遗珠");
  assert.equal(
    content.data.years[0].entries[0].image,
    `/media/${imageId}.webp`,
  );
  assert.equal(content.data.music.tracks[0].src, `/media/${audioId}.mp3`);
  assert.equal(
    readFileSync(path.join(f.outDir, `media/${audioId}.mp3`), "utf8"),
    "published audio",
  );
  const files = allFiles(f.outDir);
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
  for (const marker of [
    "DRAFT_MUST_NOT_LEAK",
    "PRIVATE_MEDIA_MUST_NOT_LEAK",
    "PASSWORD_MUST_NOT_LEAK",
    "SESSION_MUST_NOT_LEAK",
    privateId,
  ])
    assert.ok(!text.includes(marker));
  assert.ok(
    !files.some((file) => /sqlite|\.env|publishing\.json|\.log/.test(file)),
  );
  const html = readFileSync(
    path.join(f.outDir, "year/2025/entry/my-entry/index.html"),
    "utf8",
  );
  assert.ok(html.includes("公开作品 &lt;&amp;&quot;"));
  assert.ok(!html.includes("剧透秘密"));
  assert.ok(html.includes(`https://example.pages.dev/media/${imageId}.webp`));
});

test("export refuses missing media, wrong media kind and oversized files", () => {
  const f = fixture();
  const mutate = (sql) => {
    const db = new DatabaseSync(f.dbPath);
    db.exec(sql);
    db.close();
  };
  mutate(`UPDATE media SET mime='image/png' WHERE id='${audioId}'`);
  assert.throws(() => readPublishedSnapshot(f.dbPath), /缺失/);
  mutate(
    `UPDATE media SET mime='audio/mpeg',bytes=zeroblob(26214401) WHERE id='${audioId}'`,
  );
  assert.throws(() => readPublishedSnapshot(f.dbPath), /25 MiB/);
  mutate(`DELETE FROM media WHERE id='${audioId}'`);
  assert.throws(() => readPublishedSnapshot(f.dbPath), /缺失/);
});

test("entry/year routes round-trip and sharing metadata escapes injected markup", () => {
  assert.deepEqual(readerTarget(readerPath("2025", "my-entry"), ""), {
    year: "2025",
    entry: "my-entry",
    award: null,
  });
  assert.equal(readerTarget("/", "?year=2024&entry=legacy").entry, "legacy");
  assert.equal(
    readerTarget("/year/2025/", "?award=年度遗珠").award,
    "年度遗珠",
  );
  const html = socialHtml(template, {
    origin: "https://example.pages.dev",
    route: "/",
    title: "</title><script>alert(1)</script>",
    description: '"/><script>bad</script>',
  });
  assert.ok(!html.includes("<script>"));
  assert.throws(() => siteOrigin("https://user:secret@example.com/"));
  assert.throws(() => siteOrigin("http://example.com/"));
});

test("publishing queues latest update without overlapping jobs and supports retry", async () => {
  const f = fixture();
  writeFileSync(
    path.join(f.dir, "publishing.json"),
    JSON.stringify({ project: "xgn-test", url: "https://xgn-test.pages.dev" }),
  );
  let release,
    calls = 0,
    active = 0,
    maximum = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const publisher = createPublisher({
    dataDir: f.dir,
    run: async (args) => {
      active++;
      maximum = Math.max(maximum, active);
      calls++;
      if (calls === 1) await gate;
      if (args[0] === "scripts/export-public.mjs")
        writeFileSync(path.join(f.dir, "public-export.json"), '{"revision":7}');
      active--;
    },
  });
  assert.equal(publisher.start().state, "publishing");
  publisher.start();
  release();
  await publisher.wait();
  assert.equal(maximum, 1);
  assert.equal(calls, 4);
  assert.equal(publisher.status().state, "live");
  assert.equal(publisher.status().revision, 7);
  let fails = true;
  const retry = createPublisher({
    dataDir: f.dir,
    run: async () => {
      if (fails) throw new Error("network");
    },
  });
  retry.start();
  await retry.wait();
  assert.equal(retry.status().state, "failed");
  fails = false;
  retry.start();
  await retry.wait();
  assert.equal(retry.status().state, "live");
  const disconnected = createPublisher({ dataDir: path.join(f.dir, "empty") });
  assert.equal(disconnected.start().state, "unconnected");
  assert.ok(!existsSync(path.join(f.dir, "empty")));
});

test("deployment endpoint requires owner login and local origin; yearly publish starts hosting update", async (t) => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "xgn-hosting-api-"));
  let starts = 0;
  const api = createApi({
    dir,
    publisher: {
      status: () => ({ state: "idle" }),
      start: () => {
        starts++;
        return { state: "publishing" };
      },
    },
  });
  const server = createServer((req, res) => api.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.close();
    api.store.db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + "/api/hosting")).status, 401);
  assert.equal(
    (await fetch(base + "/api/deploy", { method: "POST" })).status,
    401,
  );
  const setup = await fetch(base + "/api/setup", {
    method: "POST",
    body: JSON.stringify({ password: "public-test-owner" }),
  });
  const headers = {
    cookie: setup.headers.get("set-cookie").split(";")[0],
    "Content-Type": "application/json",
  };
  assert.equal(
    (
      await fetch(base + "/api/deploy", {
        method: "POST",
        headers: { ...headers, "x-forwarded-for": "1.2.3.4" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/deploy", {
        method: "POST",
        headers: { ...headers, origin: "https://other.example" },
      })
    ).status,
    403,
  );
  const response = await fetch(base + "/api/publish", {
    method: "POST",
    headers,
    body: JSON.stringify({ year: "2025", revision: 0 }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).hosting.state, "publishing");
  assert.equal(starts, 1);
  const remote = await fetch(base + "/api/publish", {
    method: "POST",
    headers: { ...headers, "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify({ year: "2025", revision: 0 }),
  });
  assert.equal((await remote.json()).hosting.state, "local-only");
  assert.equal(starts, 1);
});

test("export failure reports actionable cause and never starts upload", async () => {
  const f = fixture();
  writeFileSync(
    path.join(f.dir, "publishing.json"),
    JSON.stringify({ project: "xgn-test", url: "https://xgn-test.pages.dev" }),
  );
  let calls = 0;
  const publisher = createPublisher({
    dataDir: f.dir,
    run: async () => {
      calls++;
      writeFileSync(
        path.join(f.dir, "public-export-error.json"),
        JSON.stringify({
          message: "免费托管单文件不能超过 25 MiB，请压缩音乐",
        }),
      );
      throw new Error("export failed");
    },
  });
  publisher.start();
  await publisher.wait();
  assert.equal(calls, 1);
  assert.match(publisher.status().message, /25 MiB/);
  assert.ok(!publisher.status().message.includes("检查网络"));
});

test("connection repair retains valid project identity despite invalid URL or corrupt settings", () => {
  const f = fixture();
  writeFileSync(
    path.join(f.dir, "publishing.json"),
    JSON.stringify({ project: "xgn-existing", url: "https://old.workers.dev" }),
  );
  assert.throws(() => publishingConfig(f.dir));
  assert.equal(savedProjectName(f.dir), "xgn-existing");
  writeFileSync(path.join(f.dir, "publishing.json"), "{broken");
  writeFileSync(
    path.join(f.dir, "cloudflare-project.json"),
    JSON.stringify({ project: "xgn-existing" }),
  );
  assert.equal(savedProjectName(f.dir), "xgn-existing");
});
