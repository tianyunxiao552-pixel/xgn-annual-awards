const bounded = (value, fallback, min, max) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function posterFrame(entry, device) {
  const frame = entry?.posterFraming?.[device];
  return {
    x: bounded(frame?.x, bounded(entry?.x, 50, 0, 100), 0, 100),
    y: bounded(frame?.y, bounded(entry?.y, 50, 0, 100), 0, 100),
    zoom: bounded(frame?.zoom, 1, 0.75, 2),
    fit:
      frame?.fit === "contain" || frame?.fit === "cover"
        ? frame.fit
        : entry?.fit === "contain"
          ? "contain"
          : "cover",
  };
}

export function posterStyle(entry, fallback = entry) {
  return Object.fromEntries(
    ["desktop", "mobile"].flatMap((device) => {
      const frame = posterFrame(
        { ...fallback, posterFraming: entry?.posterFraming },
        device,
      );
      return [
        [`--poster-x-${device}`, `${frame.x}%`],
        [`--poster-y-${device}`, `${frame.y}%`],
        [`--poster-zoom-${device}`, frame.zoom],
        [`--poster-fit-${device}`, frame.fit],
        [
          `--poster-origin-${device}`,
          frame.zoom === 1 ? "50% 50%" : `${frame.x}% ${frame.y}%`,
        ],
      ];
    }),
  );
}

// Optional metadata only: never create overrides for an untouched legacy entry.
export function normalizePosterFraming(value, entry) {
  if (!value || typeof value !== "object") return undefined;
  const frames = {};
  for (const device of ["desktop", "mobile"]) {
    const frame = value[device];
    if (!frame || typeof frame !== "object") continue;
    frames[device] = posterFrame(
      { ...entry, posterFraming: { [device]: frame } },
      device,
    );
  }
  return Object.keys(frames).length ? frames : undefined;
}
