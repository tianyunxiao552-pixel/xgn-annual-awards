import { readerTarget } from "./reader-links.js";

const DEFAULT_LOGO_PALETTE = ["#dcb750", "#61c8e2", "#dc8ece", "#ff5263"];

export function isCoverRoute(pathname, search = "") {
  const target = readerTarget(pathname, search);
  return (
    (pathname === "/" || pathname === "") &&
    !target.year &&
    !target.entry &&
    !target.award
  );
}

export function isFavoriteAward(award = "") {
  return award === "年度最爱" || award.replace(/^年度/, "") === "最爱";
}

export function coverEntries(year) {
  return (year?.entries || []).filter(
    (entry) =>
      entry.title?.trim() &&
      !entry.nominee &&
      !(
        year.example &&
        entry.id === "edgerunners-demo" &&
        entry.title === "赛博朋克：边缘行者" &&
        entry.image === "/assets/edgerunners.jpg" &&
        entry.score == null
      ),
  );
}

export function coverPrimaryEntry(year) {
  const entries = coverEntries(year);
  return (
    entries.find((entry) => isFavoriteAward(entry.award) && entry.image) ||
    entries.find((entry) => isFavoriteAward(entry.award)) ||
    entries.find((entry) => entry.image) ||
    entries[0] ||
    null
  );
}

export function yearAccent(year, fallback = "#a9c8ce") {
  return coverPrimaryEntry(year)?.accent || fallback;
}

export function coverLogoPalette(year, data) {
  const orderedEntries = (targetYear) => {
    const entries = coverEntries(targetYear);
    return [
      ...entries.filter((entry) => isFavoriteAward(entry.award)),
      ...entries.filter((entry) => !isFavoriteAward(entry.award)),
    ];
  };
  const candidates = [
    ...orderedEntries(year).map((entry) => entry.accent),
    ...coverYears(data).flatMap((item) =>
      orderedEntries(item).map((entry) => entry.accent),
    ),
    ...DEFAULT_LOGO_PALETTE,
  ];
  const palette = [];
  const seen = new Set();
  for (const color of candidates) {
    const key = color?.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    palette.push(color.trim());
    if (palette.length === 4) break;
  }
  return palette;
}

export function coverYears(data) {
  return [...(data?.years || [])].sort((a, b) => b.id.localeCompare(a.id));
}
