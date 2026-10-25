# XGN design and product QA

Date: 2026-10-22 (Asia/Shanghai)

**final result: passed**

## Visual truth and normalization

- Source visual truth: `design/reference.png` (copied from the selected generated result `exec-c41f98ae-d5d8-4108-87cb-6a17c6032532.png`).
- Source artwork: the user's original `513878_5f77g.jpg`, now `public/assets/edgerunners.jpg`. The reference ImageGen altered the poster composition. The application intentionally preserves the actual uploaded image and applies reusable CSS masks, rather than reproducing those one-off alterations.
- Implementation: complete production Node server at `http://127.0.0.1:4173/`, anonymous, 2025 / 年度最佳剧情 / example entry, no rating.
- Desktop CSS viewport: 1440 × 1024. IAB full-page screenshot: 1424 × 1900 pixels; content width is reduced by the browser's scrollbar. Pixel density 1. First 1024 px form the hero comparison. Source 1487 × 1058 was normalized to 1424 × 1024 for the comparison board; this small aspect adjustment is documented rather than treated as app drift.
- Full-view evidence: `qa/comparison-final.jpg`, reference and final implementation in the same image.
- Focused evidence: `qa/comparison-type-content.jpg`, paired source/implementation crops showing annual type, award hierarchy, source/scope, score and primary action.
- Full final implementation: `qa/desktop-final-full.png`. Standalone hero preview: `../xgn-preview.png`.
- Mobile CSS viewport: 390 × 844, `qa/mobile-final.png`. Mobile editor: `qa/editor-mobile.png`. Desktop editor: `qa/editor-desktop.png`.
- IAB viewport-only captures cropped below its visible panel area even when the CSS viewport was larger. Final desktop evidence therefore uses a full-page browser screenshot cropped to the measured 1024 px hero, not a stretched partial capture.

## Comparison history and fixes

1. Initial full-view and focused review: `qa/comparison-initial.jpg` / `qa/desktop-full-before.png`.
   - [P2] Award heading too small relative to the source, with the entry title taking its place. Fixed by introducing a distinct prominent award title and reducing the entry-title size.
   - [P2] Annual display type had insufficient height/condensation. Adjusted the display family, optical size and gaps; added a locally bundled open-source Bodoni fallback for other devices.
   - [P2] Long content could collide with the bottom award navigation at fixed desktop heights. Changed desktop hero sizing to grow with content, retained a full-viewport minimum, and limited hero excerpts to readable line counts. Full text remains in the review dialog.
2. Responsive/accessibility check:
   - [P2] Mobile header hid text labels, leaving backup and public-page controls unnamed. Added explicit accessible names.
   - [P2] Empty-award selection was lost on refresh/back. Award names now persist in the URL and restore on navigation.
   - [P2] Returning from preview could lose the edited year. Editor URLs now preserve the active year and preview's return link includes it.
3. Final post-fix full-view and focused comparison: `qa/comparison-final.jpg` and `qa/comparison-type-content.jpg`. No remaining actionable P0/P1/P2 finding. Required fidelity surfaces checked below.

## Required fidelity surfaces

- **Fonts / typography:** coherent display serif for XGN/year and Chinese serif for awards; readable body, metadata and long-review text. Year/award/entry hierarchy is restored. Bodoni/Chinese font fallback has minor weight differences from the generated mock (P3); no text overlap or hidden primary controls. Long titles wrap or truncate the hero excerpt and remain accessible in the review.
- **Spacing / layout:** black left reading region, large right poster, slim header, year tabs, divider, primary action and bottom awards correspond to the selected composition. Desktop and mobile have no document-level horizontal overflow. Mobile award strip intentionally scrolls horizontally. Final mobile action bottom ~850 px and nav top ~908 px, so controls do not overlap and remain reachable by scrolling.
- **Colors / tokens:** black/charcoal background and off-white text; accent driven by the individual poster, not a hardcoded global red. Browser upload of the supplied poster extracted `#fe004e`, close to the seeded `#ff0054`. Color can be overridden. Muted labels remain legible at their intended size.
- **Image quality / asset fidelity:** real original supplied poster, proportional cover/contain behavior, no stretching or synthetic character reconstruction, controllable focal point. No missing images in final DOM check. Phosphor library icons are used; no improvised graphic placeholders. New image uploads use the same reusable blending and entrance animation.
- **Copy / content:** interface is Chinese. Example years and placeholder review are explicitly labeled. Scores are blank until entered; the application does not assert an actual award or personal opinion on the user's behalf. Source-work and scope fields allow complete narrative segments. Missing/unpublished years and empty awards have explicit states. Public links and private draft preview are distinguished.

## Browser workflow verification

Tests used an isolated database at `work/xgn-browser-test`, with a disposable test owner. No test password or 2026 test score was copied into delivered `data/`.

- Existing owner login → year creation → inherited award settings.
- Added a narrative-segment entry, title, scope, 9.4 test score, short review, multi-paragraph full review and spoiler flag.
- Native file chooser uploaded the actual `513878_5f77g.jpg` → browser WebP preparation → authenticated server upload → thumbnail and palette visible.
- Saved draft → published only the selected test year → preview showed the uploaded poster, score and correct scope.
- Spoiler dialog initially withheld the full review; explicit reveal showed both paragraphs.
- Archive modal → 2024 empty year; award switching; refresh restored the award URL state.
- Added a custom test award and moved its position in the management dialog.
- Desktop and mobile editor forms inspected; mobile fields remained within the viewport, with named controls.
- Final production server served the app and `/edit`; owner setup remained pending, and only 2025/2024/2023 example years were present.
- Final first-run setup page inspected without entering or creating the user's password: `qa/first-run-owner.png`.
- Browser console errors/warnings checked after workflows and on the production build: none in final inspected logs.

## Backend and build checks

- `npm test`: 9 passing test results, zero failures. Covers access control, cross-site writes, image type/access control, unpublished upload privacy, draft/published isolation, optimistic revision conflicts, annual publication isolation, image/data persistence across restart, complete backups, atomic restoration and undo, unpublish and logout.
- `npm run build`: passed, including locally bundled font assets and lazy-loaded editor.
- `npm run test:sites`: 4 passing starter packaging/Worker tests. These only verify preserved static packaging; they do not imply the Node/SQLite backend can run on that static Worker.
- Production `server.mjs` launched independently of Vite, root and edit routes returned 200, setup pending, public years verified, and final screenshots came from this production server.
- Docker CLI was unavailable. Container build/runtime and public HTTPS deployment were not executed. Deploy files and persistent-volume instructions are included in README; no public hosting is claimed.

## Implementation checklist

- [x] Selected black cinematic direction implemented as reusable components.
- [x] Poster replacement and automatic processing functional.
- [x] Year, award and narrative-segment editing complete.
- [x] Password-protected edit API and durable server-side state.
- [x] Draft / per-year publish / unpublish separation.
- [x] Backup, restore and undo-restore.
- [x] Shareable annual and entry URL structure.
- [x] Responsive layout, accessible dialogs and reduced-motion support.
- [x] Full-view and focused visual comparisons after fixes.
- [x] Production runtime left running locally; first owner password belongs to the user.

## Follow-up polish / practical boundaries

- Startup follow-up: the original CMD file used LF line endings plus non-ASCII batch text. Actual `cmd.exe /d /c call` reproduced truncated commands and exit code 1. Replaced it with an ASCII/CRLF entry point and `scripts/launch.mjs`. Retested the exact CMD entry point against an existing running service (exit 0) and a cold start on isolated port 4187/data directory (HTTP session response received), then stopped only that isolated test server. The launcher opens the default browser once ready, reuses existing XGN, and keeps failures visible. This fixes the previously untested double-click startup path; no app data was reset.

- P3: exact display-font weight differs slightly across devices; supplied original poster framing naturally differs from the ImageGen remix. Both are expected and preserve the automatic-template requirement.
- Full online sharing needs deployment to an always-on Node host and a domain/HTTPS configuration. Current localhost links are local only.


## 2026-10-22 follow-up: simpler editor, pearls and annual music

The current release supersedes the older complex editor screenshots above. The daily form now shows poster, name, score and award citation, plus an optional spoiler checkbox. All twelve discussed awards are present. Image positioning, source/scope, backup and yearly management remain optional settings. Music upload is inside yearly settings, not another daily form panel.

### Verified behavior and evidence

- Production server with isolated data: http://localhost:4180; actual user site: http://127.0.0.1:4173. Test credentials, three test pearls and the WAV fixture exist only in `work/xgn-simple-ui`, never in delivered `data/` or the ZIP.
- A one-time additive award migration preserved all original entries, titles, scores, citations, media, owner and sessions; a removed default is not re-added on subsequent starts. The later music release required no migration. Actual site SQLite `state`, `owner`, `sessions` and `media` tables were independently compared with the pre-music backup and remained equal.
- Chose an empty award without creating an empty stored entry; filled only the four main fields; uploaded the supplied poster through the native file chooser, with automatic WebP preparation and palette extraction; saved and published the selected year.
- Three pearls: one image/9.2/spoiler, one text fallback/unrated, one text fallback/0.0. Switching entries preserved unsaved content. Add, remove and direct undo were exercised; undo restored the original title and position. One-card preview and empty-collection preview were exercised. Preview now saves and navigates on the first click even after editing; collection preview opens the gallery instead of immediately covering it with a review dialog.
- Gallery preserves insertion order, never score order. Clicking opens that entry's citation. Spoiler copy was withheld until explicit reveal and hidden again when reopened. Score is also available in the review metadata. Share URLs distinguish the entire gallery from a particular entry.
- Uploaded a real, decodable 12-second WAV fixture through settings; changed its display title and published. Initial player was paused at zero; user click decoded and played. Switching awards preserved playback and increasing currentTime. Switching to an unscored year without music removed the audio element and player; returning recreated a paused player at zero. Mute UI showed 0%, restore and pause worked. The fixture is a quiet test signal, not a chosen soundtrack, and is excluded from project assets.
- Desktop 1440x1024 and mobile 390x844: meaningful content, no framework overlay, no document-level horizontal overflow, gallery cards and four-field editor usable. Mobile paused player is compact; current award remains visible after viewport changes. Reduced-motion CSS also disables music-wave motion and card transitions.
- New screenshot artifacts are delivered alongside the ZIP, outside source: `../xgn-editor-current.png`, `../xgn-editor-mobile-current.png`, `../xgn-pearls-current.png`, `../xgn-pearls-mobile-current.png`. They use visibly labeled isolated demonstration content, not the user's final awards.

### Checks

| Check | Result |
|---|---|
| Build | Passed with bundled fonts and lazy editor |
| API tests | 11 passed; audio access, single/suffix/invalid ranges and HEAD, publication, backup/restore, MIME mismatch, restart, zero/null scores and multi-entry collection added to existing coverage |
| Static starter packaging | 4 passed; does not imply Node backend hosting on Sites |
| Page identity / meaningful render / framework overlay | Passed on production-served build |
| Browser console | No relevant errors or warnings in inspected final Edge logs |
| Interaction proof | Add/switch/remove/undo, preview, publish, spoiler reveal and music controls passed |

Browser tooling: CUA's documented browser Playwright APIs were used. The separately listed Browser plugin/skill is absent. Initial IAB tests covered upload, publication, playback continuity and mobile layout. An old native `window.confirm` blocked the IAB test page and its focus handling; documented dialog/close recovery did not succeed. The new pearl flow uses direct removal plus in-page undo. Final removal/undo/empty-state and final player checks were completed in the connected Edge browser through the same CUA API, not accepted based on an unresponsive click. Temporary Edge viewport override was reset.

### Independent product review and remaining boundaries

DS Flash was used once for the user's requested independent shortcomings review, based only on a frozen product brief. Registration, flash route, exposed recovery tools, ping and an empty recovery queue were checked; the substantive provider call completed in 37.41 seconds, one model turn, zero tools, zero mutations. The primary agent checked recommendations against the implementation. Valid points about collection empty/single states, undo, score distinction, spoiler protection and year-switch audio reset were addressed. Unsupported assumptions about entry-switch data loss and deployment breaking palette extraction were rejected: edits already live in the full draft state, and palette extraction happens from the local upload before storage. No measured time or quota savings are claimed.

Historical limitations at that release: no selected real music yet, and one soundtrack per year. These music limitations are superseded by the global playlist release below. Real iOS/Safari playback, a long collection of hundreds of works, container runtime and public HTTPS deployment remained untested. Backups use a 200 MB JSON import limit and grow with embedded audio. Public sharing requires hosting: localhost links cannot be opened by other people. Exact crop may still need the optional positioning controls for unusual posters.

## 2026-10-22 current release: global playlist and restrained presentation

This section supersedes the earlier annual-music behavior and screenshots. Music belongs to the site, with eight supplied tracks, including the replacement `夏の風.mp3`. The player stays mounted during year, award, editor and preview navigation. Music settings allow multiple uploads, removal and music-only publication, without publishing annual drafts. Playback starts after a user click, advances through the list and wraps. Removing a bundled track is respected on restart.

### Verified changes

- All eight supplied tracks decoded and played through the browser's actual audio element. One source named `.flac` contains MP3 bytes and is served with its detected MIME type. The unreadable original 夏の風 file was excluded; the replacement MP3 played successfully. Natural end-of-track advancement and next-track wrapping were observed. Year/award/editor/preview navigation preserved advancing playback; pause and volume controls worked.
- In isolated production-served data on port 4182, the native chooser accepted two files at once, appended both (8 to 10), and removal plus music-only save restored eight. Reload preserved the list. The final list uses a bounded scrolling area with wrapping titles. Actual user data on port 4173 was not used for test editing.
- Removed default slogans, decorative English, repeated annual introductions and giant duplicate headings. Preserved the user's own entries and introductions. The real 2025 entry 末日后酒店/9.0 is no longer labeled sample. Multi-entry collections retain insertion order, support missing images and show count without ranking.
- Typed 8.5 character by character; client rejects out-of-range scores while the backend also validates. Invalid score state clears when loading, saving or undoing. Changing the selected entry no longer incorrectly carries another entry's unpublished status.
- Empty/duplicate award renames roll back with feedback. Renaming the collection award preserves the multi-entry gallery. Keyboard focus remains on year/award controls after navigation.
- Modal padding clicks remain inside; Escape follows the current guarded close handler; body scrolling is locked while open. Browser Back closes stale modal UI, and dirty editor navigation saves before leaving. Selecting the same backup file twice opens the restore confirmation both times; restoration was not performed in that browser test.
- Annual sharing now copies the annual link. Backup media references include global music and exclude orphan uploads. Existing annual content, media, owner and sessions were compared against the pre-change snapshot and preserved; only global music was added to actual draft/published state.
- Desktop and 390x844 mobile layouts inspected; no document-level horizontal overflow. Final screenshots: `../xgn-clean-desktop.png`, `../xgn-clean-mobile.png`, `../xgn-music-settings.png`. Console warning/error logs were empty on both inspected final production pages. Temporary viewport overrides were reset.

### Checks and review boundaries

- API tests: 13 passed, including playlist migration, one-time bundled import, independent music publication, revision conflicts, media privacy/ranges, backup and restart. Build passed; static packaging tests: 4 passed. Static packaging does not establish backend hosting support.
- DS Flash performed one read-only review against frozen copies of App, Editor, styles and helpers. Registration/routes, ping and recovery queue were checked. The job completed in 409.04 seconds, 40 turns and 39 tool calls, with no mutations. The primary agent independently checked findings and fixes. The claim that score 85 could be saved was rejected because backend validation already prevented it. No measured savings are claimed.
- Real iOS/Safari, Docker runtime and public HTTPS deployment were not tested. The running address remains local. The package excludes the user's live database, owner/sessions, test data and node_modules; it includes the eight selected music assets and source. Refreshing the whole browser page naturally creates a new audio element; continuous playback is verified for navigation within the site.

## 2026-10-22 typography refinement

Scope: existing lettering and motion within the selected layout; no new promotional copy or award content in the actual site. New `Typography.jsx` and `typography.css` share the wordmark and award styling between reader and editor. The XGN SVG mark is 112px wide on desktop and 94px on mobile, with cut details and a subtle palette-derived surface. Twelve built-in award names have small signature rules, spacing or baseline differences; the favorite uses larger lettering, a double rule and a single light sweep. Navigation/index styles are restrained. User-defined award names use the neutral shared treatment.

Poster-derived color now reaches the wordmark, selected year, main award label, active award navigation and score. Each index row uses its winner's accent. The favorite is not locked to gold. A real upload of the preserved Edgerunners poster in isolated data produced `#fe004e` and a matching pink favorite gradient; the user's actual hotel poster remains unchanged with `#61c8e2` and cyan lettering. The original Downloads JPG path no longer existed; its failed test upload was replaced with the project's preserved copy, which decoded, uploaded and previewed successfully. No implementation fault was inferred from that missing source file.

Validation: meaningful production-served reader/editor/preview, correct page titles and selected awards, no framework overlays or relevant console warnings/errors. Checked desktop at 1280/1440 widths, mobile editor at 390 and reader at 419; no horizontal overflow, and the larger wordmark did not overlap editing controls. A visible paused-player label wrapping defect was corrected with smaller control padding and `white-space: nowrap`; final mobile label height was 12px. Award switching retained keyboard focus and advancing audio playback. Reduced-motion CSS disables the added animations; no real device/iOS testing or runtime reduced-motion emulation was performed. Build and four static packaging checks passed. Server code was unchanged; the earlier 13 passing API tests were reused rather than rerun for typography.

Evidence outside source: `../xgn-type-desktop.png`, `../xgn-type-mobile.png`, `../xgn-type-favorite.png`. The favorite image is labeled isolated draft test content. The user's actual year/entry/score/poster were not edited. DS Flash supplied one independent typography/motion proposal from the provided brief, with no file reads, searches, commands or mutations: 99.03 seconds, one model turn, zero tool calls. Adopted the fine-rule signatures, optical alignment, quieter index and brief motion; retained readable year sizes and poster palettes rather than following its grayscale-only proposal. No savings claims.

## 2026-10-23 final seven-point polish (active project: D:/xgn)

- All Chinese serif declarations now use the bundled Noto Serif SC stack, with real 400/600/900 faces. UI copy uses bundled Noto Sans SC 400/600. Bodoni Moda is exposed as XGN Numerals for digits/punctuation with lining/tabular features; no Georgia/Times/Source Han/Songti/SimSun system stacks remain. `prepare-fonts.mjs` emits WOFF2 Unicode shards and copies all three licenses. The browser requests shards for actual text, retaining coverage for future owner-entered names. Font checks for serif weights, sans and numerals returned true; 508 font-face declarations were present. A brief generic fallback remains possible during a cold font download because font-display is swap.
- Hero copy uses flexible bottom alignment. At 1440x1024, award content began near y=506, reading actions ended at y=834 and navigation began at y=882: the former large gap is about 48px. Share is 14px from the reading button. Poster palette and owner content are preserved.
- Award navigation has a dark backdrop, conditional edge fades and actual left/right buttons. Arrow navigation and selecting the last award were exercised; the active item stays visible without always recentering the whole strip. Empty collection has a separate 14px gray empty message, block flow and no decorative trailing point.
- Desktop music occupies a separate 64px grid row. The content scrollport ends at y=960 while the player starts at y=963 on a 1024px viewport, so the controls cannot cover award rows/footer. Navigation resets this scrollport to the top. Reader, login and modal scroll locking were checked. The authenticated editor form was not entered in this final pass; no owner password was requested or reset.
- Mobile at 390x844: only the play/pause control is visible in a 44x44 circle; playing and paused widths both remain 44px, right edge stays within the viewport, and there is no horizontal overflow. Poster plane begins at x=0, removing the former hard vertical boundary. Year changes retained advancing audio and reader navigation kept keyboard focus.
- Award index rows are 60px on desktop; visible labels omit 年度. Empty rows are dimmed and an empty favorite has no background. Section spacing, poster fade, header background and footer padding were reduced/softened. The first viewport and index were visually inspected on the production-served D-drive project.
- `npm run build` passed; four static packaging tests passed. No server/API semantics changed, so earlier API evidence was reused. No framework overlay or relevant warnings/errors in inspected browser logs. Real iOS/Safari and Docker runtime were not tested. Temporary viewport override is reset before handoff.

Evidence: D:/xgn-qa/final-polish/after-desktop.png, after-mobile.png, compact-index.png and empty-collection.png; source snapshots and build log are in the same QA folder. Owner entries, scores, posters, music and credentials were not edited. C-drive source copy was left unchanged.
