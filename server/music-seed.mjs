import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { detectAudio } from "./api.mjs";
import { musicTracks } from "../shared/music.js";

export function installBundledMusic(
  store,
  dir = path.resolve("content/music"),
) {
  const manifest = path.join(dir, "manifest.json");
  if (process.env.XGN_SKIP_BUNDLED_MUSIC === "1" || !existsSync(manifest))
    return;
  const id = "interface-music-v1";
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS content_imports(id TEXT PRIMARY KEY)",
  );
  if (store.db.prepare("SELECT id FROM content_imports WHERE id=?").get(id))
    return;
  const draft = store.read("draft").data;
  const published = store.read("published").data;
  // Existing selections belong to the owner and must never be replaced on boot.
  if (musicTracks(draft.music).length || musicTracks(published.music).length) {
    store.db.prepare("INSERT INTO content_imports VALUES(?)").run(id);
    return;
  }
  const input = JSON.parse(readFileSync(manifest, "utf8"));
  const files = input.tracks.map((track) => {
    if (!/^[a-f0-9]{32}\.(mp3|flac|m4a|wav|ogg)$/.test(track.file))
      throw new Error("Invalid bundled music file");
    const bytes = readFileSync(path.join(dir, track.file));
    if (bytes.length > 30 * 1024 * 1024)
      throw new Error("Bundled music exceeds 30 MB");
    const mediaId = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, 32);
    if (!track.file.startsWith(mediaId + "."))
      throw new Error("Bundled music checksum mismatch");
    return {
      id: mediaId,
      bytes,
      mime: detectAudio(bytes),
      title: String(track.title).slice(0, 200),
    };
  });
  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (const file of files)
      store.db
        .prepare("INSERT OR IGNORE INTO media VALUES(?,?,?,?)")
        .run(file.id, file.mime, file.bytes, Date.now());
    const music = {
      tracks: files.map((file) => ({
        src: `/media/${file.id}`,
        title: file.title,
      })),
    };
    store.write("draft", { ...draft, music });
    store.write("published", { ...published, music });
    store.db.prepare("INSERT INTO content_imports VALUES(?)").run(id);
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}
