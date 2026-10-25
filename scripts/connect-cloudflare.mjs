import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  projectRoot,
  publishingConfig,
  savedProjectName,
  runNode,
} from "../server/publishing.mjs";

process.chdir(projectRoot);
const dataDir = path.resolve(process.env.XGN_DATA_DIR || "data");
const cli = "node_modules/wrangler/bin/wrangler.js";
const interactive = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Cloudflare 操作未完成，请查看上方提示。")),
    );
  });
try {
  console.log(
    "XGN 首次连接：使用免费 Cloudflare Pages，不需要购买域名或服务器。",
  );
  const auth = await runNode([cli, "whoami"]);
  if (/not authenticated|not logged in/i.test(auth)) {
    console.log("请按窗口提示完成 Cloudflare 设备授权，完成后回到此窗口。");
    await interactive([
      "login",
      "--device",
      "--scopes",
      "account:read",
      "user:read",
      "pages:write",
    ]);
  }
  let configured = null;
  try {
    configured = publishingConfig(dataDir);
  } catch {
    console.log("连接设置有误，将复用原项目并重新取得分享地址。");
  }
  const proposalPath = path.join(dataDir, "cloudflare-project.json");
  let project = configured?.project || savedProjectName(dataDir);
  if (!project) {
    project = `xgn-${randomBytes(5).toString("hex")}`;
    await mkdir(dataDir, { recursive: true });
    await writeFile(proposalPath, JSON.stringify({ project }));
  }
  const list = async () =>
    JSON.parse(await runNode([cli, "pages", "project", "list", "--json"]));
  let projects = await list();
  if (!projects.some((item) => item["Project Name"] === project)) {
    await interactive([
      "pages",
      "project",
      "create",
      project,
      "--production-branch",
      "main",
      "--force",
    ]);
    projects = await list();
  }
  const found = projects.find((item) => item["Project Name"] === project);
  const domain = found?.["Project Domains"]
    .split(",")
    .map((value) => value.trim())
    .find((value) => value.endsWith(".pages.dev"));
  if (!domain)
    throw new Error(
      "项目已准备，但未能取得 pages.dev 地址；重新运行本脚本会复用同一项目。",
    );
  await writeFile(
    path.join(dataDir, "publishing.json"),
    JSON.stringify({ project, url: `https://${domain}` }, null, 2),
  );
  console.log(
    "连接完成。现在发布现有公开版本；以后在编辑台点「保存并发布」即可更新。",
  );
  await import("./publish.mjs");
} catch (error) {
  console.error(`连接未完成：${error.message}`);
  process.exitCode = 1;
}
