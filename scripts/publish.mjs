import { createPublisher } from "../server/publishing.mjs";
const publisher = createPublisher();
const initial = publisher.start();
if (initial.state === "unconnected") {
  console.error("请先双击「连接分享网站.cmd」，完成一次 Cloudflare 登录。");
  process.exitCode = 1;
} else {
  console.log("正在生成并上传公开版，请保持窗口打开…");
  await publisher.wait();
  const result = publisher.status();
  console.log(result.message);
  if (result.state === "live") console.log(`分享地址：${result.url}`);
  else process.exitCode = 1;
}
