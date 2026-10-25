import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { DEFAULT_AWARDS } from "../shared/awards.js";
import { musicTracks } from "../shared/music.js";
import { normalizePosterFraming } from "../shared/poster.js";
export { DEFAULT_AWARDS };
export const initialState = () => ({
  years: [
    {
      id: "2025",
      intro: "记录这一年，留在心里的作品与片段。",
      example: true,
      awards: DEFAULT_AWARDS,
      entries: [
        {
          id: "edgerunners-demo",
          award: DEFAULT_AWARDS[0],
          title: "赛博朋克：边缘行者",
          source: "",
          scope: "完整作品 · 示例",
          score: null,
          teaser: "在这里写下你的获奖理由与评语。",
          review:
            "这是展示模板的示例内容，不代表你的真实评选。\n\n上传自己的海报，填写作品或剧情段落、评分与评语，就能得到同样的展示效果。",
          image: "/assets/edgerunners.jpg",
          accent: "#ff0054",
          x: 50,
          y: 50,
          fit: "cover",
          spoiler: false,
          nominee: false,
        },
      ],
    },
    {
      id: "2024",
      intro: "这一年的故事，等待重新翻开。",
      example: true,
      awards: DEFAULT_AWARDS,
      entries: [],
    },
    {
      id: "2023",
      intro: "从记忆里，补回这一年的答案。",
      example: true,
      awards: DEFAULT_AWARDS,
      entries: [],
    },
  ],
});

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function withSiteMusic(input) {
  const music = Object.hasOwn(input, "music")
    ? input.music
    : [...input.years]
        .sort((a, b) => b.id.localeCompare(a.id))
        .find((y) => y.music)?.music;
  const { music: previousMusic, ...rest } = input;
  return {
    ...rest,
    ...(music ? { music } : {}),
    years: input.years.map(({ music: previousYearMusic, ...year }) => year),
  };
}
const str = (value, max, label) => {
  if (typeof value !== "string" || value.length > max)
    fail(`${label}格式不正确或过长`);
  return value;
};
const imagePath = (value) =>
  typeof value === "string" &&
  (value === "" ||
    value === "/assets/edgerunners.jpg" ||
    /^\/media\/[a-f0-9]{32}$/.test(value));
export function validateState(input) {
  if (!input || !Array.isArray(input.years) || input.years.length > 150)
    fail("年度数据格式不正确");
  const yearIds = new Set();
  input = withSiteMusic(input);
  const tracks = musicTracks(input.music);
  if (input.music && (!tracks.length || tracks.length > 50))
    fail("音乐列表无效");
  for (const track of tracks)
    if (!/^\/media\/[a-f0-9]{32}$/.test(track.src || ""))
      fail("音乐地址无效，请重新上传");
  return {
    ...(input.music
      ? {
          music: {
            tracks: tracks.map((track) => ({
              src: track.src,
              title: str(track.title || "背景音乐", 200, "音乐名称"),
            })),
          },
        }
      : {}),
    years: input.years.map((y) => {
      if (!/^\d{4}$/.test(y.id) || yearIds.has(y.id))
        fail("年份必须为不重复的四位数字");
      yearIds.add(y.id);
      if (
        !Array.isArray(y.awards) ||
        y.awards.length > 60 ||
        !Array.isArray(y.entries) ||
        y.entries.length > 500
      )
        fail("奖项或作品数据格式不正确");
      const awards = y.awards.map((a) => str(a, 60, "奖项").trim());
      if (awards.some((a) => !a) || new Set(awards).size !== awards.length)
        fail("奖项名称不能重复或为空");
      const ids = new Set();
      if (y.collectionAward && !awards.includes(y.collectionAward))
        fail("遗珠对应的奖项不存在");
      return {
        id: y.id,
        intro: str(y.intro || "", 2000, "年度感言"),
        example: !!y.example,
        ...(y.collectionAward ? { collectionAward: y.collectionAward } : {}),
        awards,
        entries: y.entries.map((e) => {
          if (
            typeof e.id !== "string" ||
            !/^[\w-]{1,80}$/.test(e.id) ||
            ids.has(e.id)
          )
            fail("作品编号无效或重复");
          ids.add(e.id);
          if (!awards.includes(e.award)) fail("作品对应的奖项不存在");
          if (!imagePath(e.image || "")) fail("海报地址无效");
          if (
            e.score !== null &&
            e.score !== "" &&
            e.score !== undefined &&
            (typeof e.score !== "number" ||
              !Number.isFinite(e.score) ||
              e.score < 0 ||
              e.score > 10)
          )
            fail("评分应为 0–10 分");
          if (!/^#[a-f0-9]{6}$/i.test(e.accent)) fail("点缀色格式无效");
          const posterFraming = normalizePosterFraming(e.posterFraming, e);
          return {
            id: e.id,
            award: e.award,
            title: str(e.title, 200, "作品名"),
            source: str(e.source || "", 200, "所属作品"),
            scope: str(e.scope || "", 300, "参评范围"),
            score: e.score === "" || e.score === undefined ? null : e.score,
            teaser: str(e.teaser || "", 2000, "短评"),
            review: str(e.review || "", 100000, "完整评语"),
            image: e.image || "",
            accent: e.accent,
            x: Math.max(0, Math.min(100, Number(e.x) || 0)),
            y: Math.max(0, Math.min(100, Number(e.y) || 0)),
            fit: e.fit === "contain" ? "contain" : "cover",
            ...(posterFraming ? { posterFraming } : {}),
            spoiler: !!e.spoiler,
            nominee: !!e.nominee,
          };
        }),
      };
    }),
  };
}

export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "xgn.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), salt TEXT NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL, created INTEGER NOT NULL);`);
  for (const id of ["draft", "published"])
    db.prepare("INSERT OR IGNORE INTO state(id,body) VALUES (?,?)").run(
      id,
      JSON.stringify(initialState()),
    );
  const read = (id) => {
    const r = db.prepare("SELECT * FROM state WHERE id=?").get(id);
    return { data: JSON.parse(r.body), revision: r.revision };
  };
  const write = (id, data) => {
    db.prepare("UPDATE state SET body=?, revision=revision+1 WHERE id=?").run(
      JSON.stringify(data),
      id,
    );
    return read(id);
  };
  // Promote legacy annual music once, preserving the original snapshots.
  if (
    !db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='music_upgrade'",
      )
      .get()
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = {
        draft: read("draft").data,
        published: read("published").data,
      };
      db.exec(
        "CREATE TABLE music_upgrade(id INTEGER PRIMARY KEY CHECK(id=1), previous TEXT NOT NULL)",
      );
      db.prepare("INSERT INTO music_upgrade VALUES(1,?)").run(
        JSON.stringify(previous),
      );
      for (const id of ["draft", "published"]) {
        const before = read(id).data;
        if (before.years.some((y) => Object.hasOwn(y, "music")))
          write(id, withSiteMusic(before));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  // One-time additive upgrade: keep all existing entries, custom awards and order.
  // Store the previous annual snapshots so the upgrade can be inspected/recovered.
  db.exec(
    "CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, previous TEXT NOT NULL)",
  );
  if (
    !db.prepare("SELECT id FROM migrations WHERE id=?").get("all-awards-v1")
  ) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const previous = {
        draft: read("draft").data,
        published: read("published").data,
      };
      for (const id of ["draft", "published"]) {
        const state = read(id).data;
        let changed = false;
        for (const year of state.years) {
          const missing = DEFAULT_AWARDS.filter(
            (a) => !year.awards.includes(a),
          );
          if (missing.length) {
            year.awards.push(...missing);
            changed = true;
          }
        }
        if (changed) write(id, state);
      }
      db.prepare("INSERT INTO migrations VALUES(?,?)").run(
        "all-awards-v1",
        JSON.stringify(previous),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  const ownerExists = () => !!db.prepare("SELECT id FROM owner").get();
  const password = (p) => {
    if (typeof p !== "string" || p.length < 8 || p.length > 256)
      fail("密码需要 8–256 个字符");
  };
  const setPassword = (p) => {
    password(p);
    const salt = randomBytes(16).toString("hex");
    db.prepare("INSERT OR REPLACE INTO owner VALUES(1,?,?)").run(
      salt,
      scryptSync(p, salt, 64).toString("hex"),
    );
    db.prepare("DELETE FROM sessions").run();
  };
  if (!ownerExists() && process.env.XGN_ADMIN_PASSWORD)
    setPassword(process.env.XGN_ADMIN_PASSWORD);
  return {
    db,
    read,
    write,
    ownerExists,
    setPassword,
    verify(p) {
      const o = db.prepare("SELECT * FROM owner").get();
      return (
        !!o &&
        typeof p === "string" &&
        p.length <= 256 &&
        timingSafeEqual(scryptSync(p, o.salt, 64), Buffer.from(o.hash, "hex"))
      );
    },
    session() {
      const token = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES(?,?)").run(
        token,
        Date.now() + 7 * 86400000,
      );
      return token;
    },
    authenticated(token) {
      return (
        !!token &&
        !!db
          .prepare("SELECT token FROM sessions WHERE token=? AND expires>?")
          .get(token, Date.now())
      );
    },
    revoke(token) {
      if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
    },
    publish(target) {
      const state = read("draft").data;
      const requested = Array.isArray(target) ? target : [target];
      if (!requested.length) fail("年份不存在", 404);
      const drafts = requested.map((year) => {
        const draft = state.years.find((y) => y.id === year);
        if (!draft) fail("年份不存在", 404);
        const untitled = draft.entries.find((e) => !e.title.trim());
        if (untitled)
          fail(
            requested.length > 1
              ? `发布前请补全 ${year} 年「${untitled.award}」的作品名，或移除空白条目`
              : "发布前请补全作品名，或移除空白条目",
          );
        return draft;
      });
      const pub = read("published").data;
      if (state.music) pub.music = state.music;
      else delete pub.music;
      const ids = new Set(drafts.map((d) => d.id));
      pub.years = pub.years.filter((y) => !ids.has(y.id));
      pub.years.push(...drafts);
      return write("published", pub);
    },
    publishMusic() {
      const music = read("draft").data.music;
      const pub = read("published").data;
      if (music) pub.music = music;
      else delete pub.music;
      return write("published", pub);
    },
    unpublish(year) {
      const pub = read("published").data;
      pub.years = pub.years.filter((y) => y.id !== year);
      return write("published", pub);
    },
  };
}
