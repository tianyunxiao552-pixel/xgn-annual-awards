import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createApi } from "../server/api.mjs";
import { openStore, DEFAULT_AWARDS, validateState } from "../server/store.mjs";
import { installBundledMusic } from "../server/music-seed.mjs";
import { paletteFromPixels } from "../src/lib.js";
import { posterFrame } from "../shared/poster.js";

test("device poster frames preserve legacy appearance and remain independent", () => {
  const state = {
    years: [
      {
        id: "2025",
        awards: ["年度最爱"],
        entries: [
          {
            id: "framing",
            award: "年度最爱",
            title: "海报",
            accent: "#61c8e2",
            x: 26,
            y: 73,
            fit: "contain",
          },
        ],
      },
    ],
  };
  const legacy = validateState(state).years[0].entries[0];
  assert.equal(Object.hasOwn(legacy, "posterFraming"), false);
  const original = { x: 26, y: 73, zoom: 1, fit: "contain" };
  assert.deepEqual(posterFrame(legacy, "desktop"), original);
  assert.deepEqual(posterFrame(legacy, "mobile"), original);
  state.years[0].entries[0].posterFraming = {
    mobile: { x: 68, zoom: 1.4 },
    unknown: { x: 12 },
  };
  const saved = validateState(state).years[0].entries[0];
  assert.deepEqual(posterFrame(saved, "desktop"), original);
  assert.deepEqual(posterFrame(saved, "mobile"), {
    x: 68,
    y: 73,
    zoom: 1.4,
    fit: "contain",
  });
  assert.equal(Object.hasOwn(saved.posterFraming, "unknown"), false);
  assert.deepEqual(
    validateState({ years: [{ ...state.years[0], entries: [saved] }] }).years[0]
      .entries[0],
    saved,
  );
});

test("legacy annual music becomes site music without altering awards or owner", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "xgn-site-migration-"));
  let store = openStore(dir);
  store.setPassword("migration-music-owner");
  const token = store.session();
  const old = store.read("draft").data;
  old.years[0].music = { src: `/media/${"a".repeat(32)}`, title: "旧音乐" };
  store.write("draft", old);
  store.write("published", old);
  store.db.exec("DROP TABLE music_upgrade");
  store.db.close();
  store = openStore(dir);
  const upgraded = store.read("draft").data;
  assert.equal(upgraded.music.title, "旧音乐");
  assert.equal(upgraded.years[0].music, undefined);
  assert.deepEqual(upgraded.years[0].entries, old.years[0].entries);
  assert.ok(store.verify("migration-music-owner"));
  assert.ok(store.authenticated(token));
  const renamed = structuredClone(upgraded);
  renamed.years[0].awards[11] = "特别推荐";
  renamed.years[0].collectionAward = "特别推荐";
  assert.equal(validateState(renamed).years[0].collectionAward, "特别推荐");
  store.db.close();
});

test("bundled tracks seed once, preserve content and respect later removal", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "xgn-bundled-music-"));
  const store = openStore(dir);
  // Header fixtures test import semantics without redistributing private music.
  const musicDir = path.join(dir, "music-fixtures");
  mkdirSync(musicDir);
  const tracks = Array.from({ length: 8 }, (_, i) => {
    const bytes = Buffer.alloc(32, i);
    bytes.write("ID3", 0);
    const file = createHash("sha256").update(bytes).digest("hex").slice(0, 32) + ".mp3";
    writeFileSync(path.join(musicDir, file), bytes);
    return { file, title: `Test track ${i + 1}` };
  });
  writeFileSync(path.join(musicDir, "manifest.json"), JSON.stringify({ tracks }));
  try {
    const years = store.read("draft").data.years;
    installBundledMusic(store, musicDir);
    const draft = store.read("draft").data;
    assert.equal(draft.music.tracks.length, 8);
    assert.deepEqual(draft.years, years);
    const types = store.db
      .prepare("SELECT mime FROM media")
      .all()
      .map((m) => m.mime);
    assert.equal(types.filter((mime) => mime === "audio/flac").length, 0);
    assert.equal(types.filter((mime) => mime === "audio/mpeg").length, 8);
    assert.equal(validateState(draft).music.tracks.length, 8);
    store.write("draft", { ...draft, music: null });
    store.write("published", { ...draft, music: null });
    installBundledMusic(store, musicDir);
    assert.equal(store.read("published").data.music, null);
  } finally {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("site music and multiple pearls: private upload, ranges, publication, backup and restart", async () => {
  const work = os.tmpdir();
  mkdirSync(work, { recursive: true });
  const dir = mkdtempSync(path.join(work, "xgn-music-"));
  let app = createApi({ dir });
  const server = createServer((req, res) => app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie;
  const call = (
    route,
    { method = "GET", data, bytes, auth = true, headers = {} } = {},
  ) =>
    fetch(base + route, {
      method,
      headers: { ...(auth && cookie ? { Cookie: cookie } : {}), ...headers },
      body: bytes || (data ? JSON.stringify(data) : undefined),
    });
  try {
    const wav = Buffer.alloc(108, 0);
    wav.write("RIFF", 0);
    wav.write("WAVE", 8);
    assert.equal(
      (await call("/api/audio", { method: "POST", bytes: wav })).status,
      401,
    );
    const owner = await call("/api/setup", {
      method: "POST",
      data: { password: "music-test-owner" },
    });
    cookie = owner.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (
        await call("/api/audio", {
          method: "POST",
          bytes: Buffer.from("<html>fake audio</html>"),
        })
      ).status,
      400,
    );
    const upload = await call("/api/audio", { method: "POST", bytes: wav });
    assert.equal(upload.status, 201);
    const { src } = await upload.json();
    assert.equal((await call(src, { auth: false })).status, 404);
    let draft = await (await call("/api/draft")).json();
    const y = draft.data.years[0];
    draft.data.music = { tracks: [{ src, title: "全站音乐测试" }] };
    const model = y.entries[0];
    y.entries.push(
      ...[null, 0, 8.7].map((score, i) => ({
        ...model,
        id: `pearl-${i}`,
        award: "年度遗珠",
        title: `遗珠${i}`,
        score,
        image: "",
      })),
    );
    draft = await (
      await call("/api/draft", { method: "PUT", data: draft })
    ).json();
    assert.deepEqual(
      draft.data.years[0].entries.slice(-3).map((e) => e.score),
      [null, 0, 8.7],
    );
    assert.equal((await call(src, { auth: false })).status, 404);
    assert.equal(
      (
        await call("/api/publish-music", {
          method: "POST",
          data: { revision: -1 },
        })
      ).status,
      409,
    );
    const beforeMusic = await (await call("/api/public")).json();
    assert.equal(
      (
        await call("/api/publish-music", {
          method: "POST",
          data: { revision: draft.revision },
        })
      ).status,
      200,
    );
    const afterMusic = await (await call("/api/public")).json();
    assert.deepEqual(afterMusic.data.years, beforeMusic.data.years);
    assert.equal(afterMusic.data.music.tracks.length, 1);
    assert.equal((await call(src, { auth: false })).status, 200);
    assert.equal(
      (
        await call("/api/publish", {
          method: "POST",
          data: { year: y.id, revision: draft.revision },
        })
      ).status,
      200,
    );
    const range = await call(src, {
      auth: false,
      headers: { Range: "bytes=8-11" },
    });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), "bytes 8-11/108");
    assert.equal(range.headers.get("content-type"), "audio/wav");
    assert.equal(await range.text(), "WAVE");
    const suffix = await call(src, {
      auth: false,
      headers: { Range: "bytes=-5" },
    });
    assert.equal(suffix.status, 206);
    assert.equal((await suffix.arrayBuffer()).byteLength, 5);
    for (const invalid of [
      "bytes=999-",
      "bytes=20-2",
      "bytes=-0",
      "bytes=0-1,3-4",
    ])
      assert.equal(
        (await call(src, { headers: { Range: invalid } })).status,
        416,
      );
    const head = await call(src, {
      method: "HEAD",
      headers: { Range: "bytes=4-" },
    });
    assert.equal(head.status, 206);
    assert.equal(head.headers.get("content-length"), "104");
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    await call("/api/audio", { method: "POST", bytes: wav });
    const backup = await (await call("/api/backup")).json();
    assert.equal(backup.media.length, 1);
    assert.equal(backup.media[0].mime, "audio/wav");
    const missing = structuredClone(backup);
    missing.media = [];
    assert.equal(
      (await call("/api/restore", { method: "POST", data: missing })).status,
      400,
    );
    const wrong = structuredClone(backup);
    wrong.draft.years[0].entries[0].image = src;
    assert.equal(
      (await call("/api/restore", { method: "POST", data: wrong })).status,
      400,
    );
    await call("/api/unpublish", { method: "POST", data: { year: y.id } });
    assert.equal((await call(src, { auth: false })).status, 200);
    assert.equal(
      (await call("/api/restore", { method: "POST", data: backup })).status,
      200,
    );
    app.store.db.close();
    app = createApi({ dir });
    const pub = await (await call("/api/public", { auth: false })).json();
    const restoredYear = pub.data.years.find((item) => item.id === y.id);
    assert.equal(pub.data.music.tracks[0].title, "全站音乐测试");
    assert.equal(
      restoredYear.entries.filter((e) => e.award === "年度遗珠").length,
      3,
    );
    assert.deepEqual(
      Buffer.from(await (await call(src, { auth: false })).arrayBuffer()),
      wav,
    );
    draft = await (await call("/api/draft")).json();
    draft.data.music = null;
    const without = await call("/api/draft", { method: "PUT", data: draft });
    assert.equal(without.status, 200);
    const withoutData = await without.json();
    assert.equal(withoutData.data.music, undefined);
    assert.equal((await call(src, { auth: false })).status, 200);
    await call("/api/publish-music", {
      method: "POST",
      data: { revision: withoutData.revision },
    });
    assert.equal((await call(src, { auth: false })).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.store.db.close();
  }
});

test("award upgrade appends all recommendations once and preserves user content and login", () => {
  const work = os.tmpdir();
  mkdirSync(work, { recursive: true });
  const dir = mkdtempSync(path.join(work, "xgn-awards-upgrade-"));
  let store = openStore(dir);
  store.setPassword("migration-test-password");
  const token = store.session();
  const original = store.read("draft").data;
  original.years[0].awards = ["我的自定义奖", "年度最佳剧情", "年度最爱"];
  original.years[0].entries[0].review = "用户亲自填写的颁奖词";
  original.years[0].entries[0].score = 8.7;
  store.write("draft", original);
  const published = structuredClone(original);
  published.years[0].entries[0].review = "此前公开的颁奖词";
  store.write("published", published);
  store.db.prepare("DELETE FROM migrations WHERE id=?").run("all-awards-v1");
  store.db.close();
  store = openStore(dir);
  for (const [id, before] of [
    ["draft", original],
    ["published", published],
  ]) {
    const after = store.read(id).data;
    assert.deepEqual(
      after.years[0].awards.slice(0, 3),
      original.years[0].awards,
    );
    assert.ok(DEFAULT_AWARDS.every((a) => after.years[0].awards.includes(a)));
    assert.equal(
      new Set(after.years[0].awards).size,
      after.years[0].awards.length,
    );
    assert.deepEqual(after.years[0].entries, before.years[0].entries);
  }
  assert.ok(store.verify("migration-test-password"));
  assert.ok(store.authenticated(token));
  const chosen = store.read("draft").data;
  chosen.years[0].awards = chosen.years[0].awards.filter(
    (a) => a !== "年度遗珠",
  );
  store.write("draft", chosen);
  store.db.close();
  store = openStore(dir);
  assert.ok(!store.read("draft").data.years[0].awards.includes("年度遗珠"));
  store.db.close();
});

test("poster palette ignores black and white; extracts saturated artwork colour", () => {
  assert.equal(
    paletteFromPixels(
      new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 80, 255, 255, 0, 80, 255,
      ]),
    ),
    "#ff0050",
  );
  assert.equal(
    paletteFromPixels(
      new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    ),
    "#d5c5a6",
  );
});

test("owner → upload → draft → publish → backup/restore → persisted restart", async (t) => {
  const work = os.tmpdir();
  mkdirSync(work, { recursive: true });
  const dir = mkdtempSync(path.join(work, "xgn-api-"));
  let app = createApi({ dir });
  const server = createServer((req, res) => app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = "";
  const req = async (
    endpoint,
    { data, method = "GET", auth = true, bytes, origin } = {},
  ) => {
    const r = await fetch(base + endpoint, {
      method,
      headers: {
        ...(cookie && auth ? { Cookie: cookie } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: bytes || (data ? JSON.stringify(data) : undefined),
    });
    const type = r.headers.get("content-type") || "";
    return {
      status: r.status,
      headers: r.headers,
      data: type.includes("json")
        ? await r.json()
        : Buffer.from(await r.arrayBuffer()),
    };
  };
  try {
    await t.test(
      "private drafts and editing APIs require authentication",
      async () => {
        assert.equal((await req("/api/draft")).status, 401);
        assert.equal(
          (
            await req("/api/upload", {
              method: "POST",
              bytes: Buffer.alloc(12),
            })
          ).status,
          401,
        );
        assert.equal((await req("/api/session")).data.setup, true);
        assert.equal(
          (
            await req("/api/setup", {
              method: "POST",
              data: { password: "short" },
            })
          ).status,
          400,
        );
        const r = await req("/api/setup", {
          method: "POST",
          data: { password: "xgn-test-only-password" },
        });
        assert.equal(r.status, 200);
        cookie = r.headers.get("set-cookie").split(";")[0];
        assert.match(r.headers.get("set-cookie"), /HttpOnly/);
        assert.equal(
          (
            await req("/api/setup", {
              method: "POST",
              data: { password: "other-password" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await req("/api/login", {
              method: "POST",
              data: { password: "incorrect" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await req("/api/logout", {
              method: "POST",
              data: {},
              origin: "https://untrusted.example",
            })
          ).status,
          403,
        );
      },
    );
    let draft, image;
    await t.test(
      "image type validation; unpublished uploaded images stay private",
      async () => {
        assert.equal(
          (
            await req("/api/upload", {
              method: "POST",
              bytes: Buffer.from('<svg onload="bad"/>'),
            })
          ).status,
          400,
        );
        const jpg = readFileSync("public/assets/edgerunners.jpg");
        const r = await req("/api/upload", { method: "POST", bytes: jpg });
        assert.equal(r.status, 201);
        image = r.data.image;
        assert.equal((await req(image, { auth: false })).status, 404);
        assert.deepEqual((await req(image)).data, jpg);
      },
    );
    await t.test(
      "saving a year changes drafts only, with optimistic concurrency",
      async () => {
        draft = (await req("/api/draft")).data;
        const entry = {
          ...draft.data.years[0].entries[0],
          id: "story-test",
          award: "年度最佳剧情",
          title: "完整剧情段落",
          image,
          score: 9.1,
          posterFraming: {
            desktop: { x: 20, y: 60, zoom: 1.1, fit: "cover" },
            mobile: { x: 80, y: 35, zoom: 1.45, fit: "contain" },
          },
          spoiler: true,
        };
        draft.data.years.push({
          id: "2026",
          intro: "测试年度",
          example: false,
          awards: ["年度最佳剧情"],
          entries: [entry],
        });
        const r = await req("/api/draft", { method: "PUT", data: draft });
        assert.equal(r.status, 200);
        draft = r.data;
        assert.equal(
          (await req("/api/public", { auth: false })).data.data.years.some(
            (y) => y.id === "2026",
          ),
          false,
        );
        assert.equal(
          (
            await req("/api/draft", {
              method: "PUT",
              data: { ...draft, revision: -1 },
            })
          ).status,
          409,
        );
        assert.equal((await req(image, { auth: false })).status, 404);
      },
    );
    await t.test(
      "publishing a selected year leaves other annual editions unchanged",
      async () => {
        const original = (await req("/api/public")).data.data.years.find(
          (y) => y.id === "2025",
        );
        assert.equal(
          (
            await req("/api/publish", {
              method: "POST",
              data: { year: "2026", revision: draft.revision },
            })
          ).status,
          200,
        );
        const pub = (await req("/api/public", { auth: false })).data.data;
        assert.deepEqual(
          pub.years.find((y) => y.id === "2025"),
          original,
        );
        assert.equal(
          pub.years.find((y) => y.id === "2026").entries[0].score,
          9.1,
        );
        assert.equal((await req(image, { auth: false })).status, 200);
        assert.deepEqual(
          pub.years.find((y) => y.id === "2026").entries[0].posterFraming,
          draft.data.years.find((y) => y.id === "2026").entries[0]
            .posterFraming,
        );
        draft.data.years.find((y) => y.id === "2026").entries[0].title =
          "还未公开的修改";
        draft = (await req("/api/draft", { method: "PUT", data: draft })).data;
        assert.equal(
          (await req("/api/public")).data.data.years.find(
            (y) => y.id === "2026",
          ).entries[0].title,
          "完整剧情段落",
        );
      },
    );
    await t.test(
      "publishing multiple edited years updates all specified annual editions together",
      async () => {
        const y2024 = draft.data.years.find((y) => y.id === "2024");
        const y2023 = draft.data.years.find((y) => y.id === "2023");
        y2024.example = false;
        y2024.entries = [
          {
            ...draft.data.years[0].entries[0],
            id: "fav-2024",
            award: "年度最爱",
            title: "樱之诗",
            image: "",
          },
        ];
        y2023.example = false;
        y2023.entries = [
          {
            ...draft.data.years[0].entries[0],
            id: "fav-2023",
            award: "年度最爱",
            title: "MyGO!!!!!",
            image: "",
          },
        ];
        draft = (await req("/api/draft", { method: "PUT", data: draft })).data;
        const p = await req("/api/publish", {
          method: "POST",
          data: {
            year: "2023",
            years: ["2024", "2023"],
            revision: draft.revision,
          },
        });
        assert.equal(p.status, 200);
        const pub = (await req("/api/public", { auth: false })).data.data;
        assert.equal(
          pub.years.find((y) => y.id === "2024").entries[0].title,
          "樱之诗",
        );
        assert.equal(
          pub.years.find((y) => y.id === "2023").entries[0].title,
          "MyGO!!!!!",
        );
      },
    );
    await t.test(
      "backups include images but no credentials; restore is atomic and reversible",
      async () => {
        const backup = (await req("/api/backup")).data;
        assert.deepEqual(
          backup.published.years.find((y) => y.id === "2026").entries[0]
            .posterFraming,
          draft.data.years.find((y) => y.id === "2026").entries[0]
            .posterFraming,
        );
        assert.equal(backup.media.length, 1);
        assert.equal("owner" in backup, false);
        assert.equal("sessions" in backup, false);
        const invalid = structuredClone(backup);
        invalid.media = [];
        assert.equal(
          (await req("/api/restore", { method: "POST", data: invalid })).status,
          400,
        );
        assert.equal(
          (await req("/api/public")).data.data.years.length,
          backup.published.years.length,
        );
        const alternate = structuredClone(backup);
        alternate.published.years = alternate.published.years.filter(
          (y) => y.id !== "2026",
        );
        assert.equal(
          (await req("/api/restore", { method: "POST", data: alternate }))
            .status,
          200,
        );
        assert.equal(
          (await req("/api/public")).data.data.years.some(
            (y) => y.id === "2026",
          ),
          false,
        );
        assert.equal(
          (await req("/api/undo-restore", { method: "POST", data: {} })).status,
          200,
        );
        assert.equal(
          (await req("/api/public")).data.data.years.some(
            (y) => y.id === "2026",
          ),
          true,
        );
        assert.deepEqual(
          (await req("/api/public")).data.data.years.find(
            (y) => y.id === "2026",
          ).entries[0].posterFraming,
          backup.published.years.find((y) => y.id === "2026").entries[0]
            .posterFraming,
        );
      },
    );
    await t.test(
      "data and uploaded images survive server/store restart",
      async () => {
        app.store.db.close();
        app = createApi({ dir });
        assert.equal((await req("/api/draft")).status, 200);
        assert.equal(
          (await req("/api/public")).data.data.years.find(
            (y) => y.id === "2026",
          ).entries[0].title,
          "完整剧情段落",
        );
        assert.equal((await req(image, { auth: false })).status, 200);
      },
    );
    await t.test(
      "unpublish removes public data and image access but keeps editable drafts",
      async () => {
        assert.equal(
          (
            await req("/api/unpublish", {
              method: "POST",
              data: { year: "2026" },
            })
          ).status,
          200,
        );
        assert.equal((await req(image, { auth: false })).status, 404);
        assert.equal(
          (await req("/api/draft")).data.data.years.some(
            (y) => y.id === "2026",
          ),
          true,
        );
        await req("/api/logout", { method: "POST", data: {} });
        assert.equal((await req("/api/draft")).status, 401);
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.store.db.close();
  }
});
