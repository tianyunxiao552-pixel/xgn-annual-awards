export const CORE_AWARDS = [
  "年度最爱",
  "年度最佳剧情",
  "年度最上瘾",
  "年度最失望",
  "年度出乎意料",
];
export const MORE_AWARDS = [
  "年度最难释怀",
  "年度最佳角色",
  "年度最佳关系",
  "年度最佳瞬间",
  "年度最佳氛围",
  "年度声音记忆",
  "年度遗珠",
];
export const DEFAULT_AWARDS = [...CORE_AWARDS, ...MORE_AWARDS];
export function orderedAwards(awards = []) {
  return awards.includes("年度最爱")
    ? ["年度最爱", ...awards.filter((award) => award !== "年度最爱")]
    : [...awards];
}
export function isCollectionAward(year, award) {
  return award === (year?.collectionAward || "年度遗珠");
}
