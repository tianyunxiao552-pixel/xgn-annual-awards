import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { siteOrigin } from "./public-export.mjs";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export function savedProjectName(dataDir) {
  for (const name of ["publishing.json", "cloudflare-project.json"]) {
    try {
      const { project } = JSON.parse(
        readFileSync(path.join(dataDir, name), "utf8"),
      );
      if (/^[a-z0-9][a-z0-9-]{0,57}$/.test(project || "")) return project;
    } catch {
      /* Recover from missing or invalid connection files. */
    }
  }
  return null;
}
export function publishingConfig(dataDir) {
  let config;
  try {
    config = JSON.parse(
      readFileSync(path.join(dataDir, "publishing.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(config.project || ""))
    throw new Error("分享网站配置中的项目名无效");
  const url = siteOrigin(config.url);
  if (!url || !new URL(url).hostname.endsWith(".pages.dev"))
    throw new Error("分享网站地址无效");
  return { project: config.project, url };
}

export function runNode(
  args,
  { root = projectRoot, dataDir, log = () => {} } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: "1",
        WRANGLER_SEND_METRICS: "false",
        ...(dataDir ? { XGN_DATA_DIR: dataDir } : {}),
      },
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr])
      stream.on("data", (bytes) => {
        output = (output + bytes.toString()).slice(-24000);
        log(bytes.toString());
      });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`发布命令失败（${code}）\n${output}`)),
    );
  });
}

export function createPublisher({
  dataDir,
  root = projectRoot,
  run = runNode,
} = {}) {
  dataDir = path.resolve(
    dataDir || process.env.XGN_DATA_DIR || path.join(root, "data"),
  );
  const statusPath = path.join(dataDir, "publishing-status.json");
  let current = { state: "idle" },
    running = null,
    queued = false;
  try {
    const previous = JSON.parse(readFileSync(statusPath, "utf8"));
    current =
      previous.state === "publishing"
        ? {
            ...previous,
            state: "failed",
            message: "上次发布尚未完成，请重试。",
          }
        : previous;
  } catch {
    /* First publication. */
  }
  const config = () => publishingConfig(dataDir);
  const status = () => {
    try {
      const connected = config();
      if (!running) {
        try {
          const latest = JSON.parse(readFileSync(statusPath, "utf8"));
          if (latest.state !== "publishing") current = latest;
        } catch {
          /* No persisted result yet. */
        }
      }
      return connected
        ? { ...current, url: connected.url }
        : {
            state: "unconnected",
            message: "首次上线：双击项目里的「连接分享网站.cmd」",
          };
    } catch {
      return { state: "failed", message: "分享网站配置无法读取，请重新连接。" };
    }
  };
  const persist = () => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(statusPath, JSON.stringify(current, null, 2));
  };
  const start = () => {
    let connected;
    try {
      connected = config();
    } catch {
      return status();
    }
    if (!connected) return status();
    if (running) {
      queued = true;
      return status();
    }
    current = {
      ...current,
      state: "publishing",
      url: connected.url,
      message: "正在更新分享网站…",
    };
    persist();
    running = (async () => {
      do {
        queued = false;
        let exported = false;
        try {
          let log = "";
          const options = {
            root,
            dataDir,
            log: (text) => {
              log = (log + text).slice(-48000);
            },
          };
          try {
            writeFileSync(path.join(dataDir, "public-export-error.json"), "{}");
            await run(["scripts/export-public.mjs"], options);
            exported = true;
            const report = JSON.parse(
              readFileSync(path.join(dataDir, "public-export.json"), "utf8"),
            );
            await run(
              [
                "node_modules/wrangler/bin/wrangler.js",
                "pages",
                "deploy",
                "dist/public-site",
                "--project-name",
                connected.project,
                "--branch",
                "main",
                "--commit-dirty=true",
              ],
              options,
            );
            current = {
              state: "live",
              url: connected.url,
              revision: report.revision,
              updatedAt: new Date().toISOString(),
              message: "分享网站已更新",
            };
          } finally {
            writeFileSync(path.join(dataDir, "publishing.log"), log);
          }
        } catch {
          let reason = "公开网页生成失败，请查看本机 data/publishing.log。";
          try {
            const failure = JSON.parse(
              readFileSync(
                path.join(dataDir, "public-export-error.json"),
                "utf8",
              ),
            );
            if (typeof failure.message === "string")
              reason = failure.message.slice(0, 1000);
          } catch {
            /* A process startup failure has no export report. */
          }
          current = {
            ...current,
            state: "failed",
            message: exported
              ? "公开网页已生成，上传失败。检查网络或重新连接 Cloudflare 后重试。"
              : `内容已保存在本机，网站未更新：${reason}`,
          };
        }
        if (queued)
          current = {
            ...current,
            state: "publishing",
            message: "正在更新最新版本…",
          };
        persist();
      } while (queued);
    })().finally(() => {
      running = null;
    });
    return status();
  };
  return { status, start, wait: () => running || Promise.resolve() };
}
