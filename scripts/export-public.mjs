import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { build } from "vite";
import { writePublicSnapshot } from "../server/public-export.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
const dataDir = path.resolve(process.env.XGN_DATA_DIR || "data");
async function main() {
  let config = {};
  try {
    config = JSON.parse(
      await readFile(path.join(dataDir, "publishing.json"), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await import("./prepare-fonts.mjs");
  await build({
    configFile: path.join(root, "vite.config.mjs"),
    mode: "public",
  });
  const report = await writePublicSnapshot({
    dbPath: path.join(dataDir, "xgn.sqlite"),
    outDir: path.join(root, "dist/public-site"),
    origin: config.url || "",
  });
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    path.join(dataDir, "public-export.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `公开版已生成：dist/public-site（${report.entries} 条评选，${report.media} 个媒体，${(report.bytes / 1048576).toFixed(1)} MB）`,
  );
}
try {
  await main();
} catch (error) {
  await mkdir(dataDir, { recursive: true });
  const message =
    error.publicMessage ||
    (error.status === 400
      ? error.message
      : "公开网页生成失败，请查看本机 data/publishing.log。");
  await writeFile(
    path.join(dataDir, "public-export-error.json"),
    JSON.stringify({ message }),
  );
  console.error(message);
  process.exitCode = 1;
}
