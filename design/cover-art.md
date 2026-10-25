# XGN 封面设计记录

封面首先呈现已有 XGN 切角字标，年份横排在下方；没有奖项结果、宣传语或第二个字标。背景使用独立的虚焦光影素材，代码驱动缓慢位移、呼吸和柔光掠过。上传作品和编辑字段保持原有流程。

本次参考了 DS 的片头式视觉建议，以及独立体验顾问对进入节奏、空年份、触控和返回行为的建议。最终保留明确的进入按钮、可选择的横排年份和显式音乐播放；不增加年度目录中转页，不在点击年份时自动放音乐。分享的年份和作品链接直接进入内容。返回封面不重复完整入场，系统减少动态效果时关闭背景动画。

## 素材

- 工具：内置 Image Gen，两次调用（完整视觉概念、提取无字背景）。
- 概念：`D:/xgn/design/cover-concept.png`。
- 实际背景：`D:/xgn/src/assets/cover-ambient.png`，1.64 MiB，1536 × 1024。
- Logo：沿用 `src/Typography.jsx` 的矢量字标，未将概念图里的字形或按钮烘焙进网页。
- 代码：`src/Cover.jsx`、`src/cover.css`；路由与年份规则：`shared/cover.js`。

## 最终提示词

### 完整封面概念

Create ONE finished visual concept screenshot at 1440x960 for a new cover page of XGN, a personal Chinese annual entertainment awards archive, using the existing site for its established brand mark and restrained black cinematic design language. The root URL now opens a sophisticated film opening title card. Main priority: the first thing seen is the existing angular geometric XGN logo, large but elegant, about 50% viewport width, horizontally centered at about 44% viewport height. Preserve the existing angular identity, not a generic serif or new logo. Soft off-white slightly metallic letters with subtle reflected cyan light, fine hairline seams, generous near-black negative space. Background: indistinct out-of-focus teal light at right and warm smoky light at lower left; no recognizable scene or poster collage. Visible functional text only: small 年度档案, XGN once, 2025 and a small 进入年度 button with thin right arrow. Minimal music control. No slogans, decorative English, stars, glitter, confetti, neon, globes, trophies, loading indicators or giant poster headings. Adapt to mobile with clear click targets. No browser chrome or device frame. Reference: the existing site's desktop screenshot.

用户随后要求年份横排，正式实现改为横排年份；图中的年份单项并非最终交互规格。

### 提取背景素材

Extract a clean standalone cinematic ambient BACKGROUND asset from the attached XGN cover concept. Remove ALL foreground interface elements completely: remove XGN letters, the top Chinese label, 2025, the divider, button, arrow, music icons and music title. Inpaint every removed area to natural near-black atmospheric negative space. Preserve the scene's beautiful restrained out-of-focus teal light at right and dim warm smoke at lower left, shadowy fine film grain, and subtle reflected light along the very bottom. Center 65% must remain nearly black, without objects, so the real code-rendered logo can sit there later. Do not add any text, logo, icon, typography, borders, stars, glitter, neon or recognizable objects. No hard horizon line. Keep the same wide 1536x1024 aspect ratio composition, complete full-bleed background, seamless natural atmosphere. The overall background will be darker and softer than the concept so logo stays the brightest thing. This is a real reusable background asset, not a UI screenshot. Do not include any interface.

## 验证

新增两项测试覆盖封面路由、旧深链绕过、公开年份及样例过滤；公开导出七项及原有打包四项检查通过。浏览器检查了 1440 × 960 桌面和 390 × 844 手机、空年份、进入/返回、作品直达、音乐连续播放、无横向溢出和控制台健康。最终发布复用原 Cloudflare Pages 项目。
