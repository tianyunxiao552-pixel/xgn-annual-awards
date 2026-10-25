export function musicTracks(music) {
  return Array.isArray(music?.tracks)
    ? music.tracks
    : music?.src
      ? [music]
      : [];
}

export function pickInitialTrackIndex(
  count,
  previousIndex = null,
  random = Math.random,
) {
  if (!Number.isInteger(count) || count <= 1) return 0;
  const raw = Math.floor(random() * count);
  const index = Math.max(0, Math.min(count - 1, raw));
  if (
    Number.isInteger(previousIndex) &&
    previousIndex >= 0 &&
    previousIndex < count &&
    index === previousIndex
  ) {
    return (index + 1 + Math.floor(random() * (count - 1))) % count;
  }
  return index;
}
