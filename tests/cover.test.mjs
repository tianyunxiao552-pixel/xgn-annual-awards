import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCoverRoute,
  coverYears,
  coverEntries,
  coverPrimaryEntry,
  yearAccent,
  coverLogoPalette,
} from "../shared/cover.js";
import { pickInitialTrackIndex } from "../shared/music.js";
import { DEFAULT_AWARDS, orderedAwards } from "../shared/awards.js";

test("favorite leads without mutating existing custom award order or dropping awards", () => {
  const awards = ["自定义奖", "年度最佳剧情", "年度最爱", "年度遗珠", "另一奖"];
  const before = [...awards];
  assert.deepEqual(orderedAwards(awards), [
    "年度最爱",
    "自定义奖",
    "年度最佳剧情",
    "年度遗珠",
    "另一奖",
  ]);
  assert.deepEqual(awards, before);
  assert.equal(DEFAULT_AWARDS[0], "年度最爱");
  assert.deepEqual(orderedAwards(["甲", "乙"]), ["甲", "乙"]);
});

test("only the unqualified homepage opens the cover; existing shared links bypass it", () => {
  assert.ok(isCoverRoute("/"));
  assert.ok(isCoverRoute("/", "?utm_source=share"));
  for (const [pathname, search] of [
    ["/", "?year=2025"],
    ["/", "?entry=my-entry"],
    ["/", "?award=年度遗珠"],
    ["/year/2025/", ""],
    ["/year/2025/entry/my-entry/", ""],
    ["/preview", ""],
    ["/edit", ""],
  ])
    assert.equal(isCoverRoute(pathname, search), false);
});

test("cover uses public years without mutation and only enables genuine collected entries", () => {
  const data = {
    years: [
      { id: "2023", entries: [] },
      {
        id: "2025",
        entries: [
          {
            id: "edgerunners-demo",
            title: "末日后酒店",
            score: 0,
            image: "/media/own",
            nominee: false,
          },
        ],
      },
      {
        id: "2024",
        example: true,
        entries: [
          {
            id: "edgerunners-demo",
            title: "赛博朋克：边缘行者",
            image: "/assets/edgerunners.jpg",
            score: null,
          },
        ],
      },
    ],
  };
  const before = structuredClone(data);
  assert.deepEqual(
    coverYears(data).map((y) => y.id),
    ["2025", "2024", "2023"],
  );
  assert.equal(coverEntries(data.years[1]).length, 1);
  assert.equal(coverEntries(data.years[2]).length, 0);
  assert.deepEqual(data, before);
  assert.deepEqual(coverYears(null), []);
});

test("year accent follows 年度最爱 instead of 年度最佳剧情, and cover logo builds a 4-color palette", () => {
  const year2025 = {
    id: "2025",
    entries: [
      {
        id: "story",
        award: "年度最佳剧情",
        title: "末日后酒店",
        accent: "#61c8e2",
        image: "/media/story",
      },
      {
        id: "fav",
        award: "年度最爱",
        title: "千年女优",
        accent: "#dcb750",
        image: "/media/fav",
      },
      {
        id: "addictive",
        award: "年度最上瘾",
        title: "魔法少女的魔女审判",
        accent: "#dc8ece",
        image: "/media/addictive",
      },
      {
        id: "disappoint",
        award: "年度最失望",
        title: "BanG Dream! Ave Mujica",
        accent: "#dc0205",
        image: "/media/disappoint",
      },
    ],
  };
  assert.equal(coverPrimaryEntry(year2025)?.id, "fav");
  assert.equal(yearAccent(year2025), "#dcb750");
  assert.deepEqual(coverLogoPalette(year2025, { years: [year2025] }), [
    "#dcb750",
    "#61c8e2",
    "#dc8ece",
    "#dc0205",
  ]);
  assert.equal(coverLogoPalette({ id: "2024", entries: [] }, null).length, 4);
});

test("initial music track is chosen randomly and avoids repeating the previous starting track", () => {
  assert.equal(pickInitialTrackIndex(0), 0);
  assert.equal(
    pickInitialTrackIndex(1, 0, () => 0.9),
    0,
  );
  assert.equal(
    pickInitialTrackIndex(8, null, () => 0.5),
    4,
  );
  for (let prev = 0; prev < 8; prev++) {
    const picked = pickInitialTrackIndex(8, prev, () => prev / 8);
    assert.notEqual(picked, prev);
    assert.ok(picked >= 0 && picked < 8);
  }
});
