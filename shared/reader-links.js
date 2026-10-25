export function readerPath(year, entry) {
  return `/year/${encodeURIComponent(year)}/${entry ? `entry/${encodeURIComponent(entry)}/` : ""}`;
}

export function readerTarget(pathname, search) {
  const params = new URLSearchParams(search);
  const match = /^\/year\/(\d{4})(?:\/entry\/([\w-]{1,80}))?\/?$/.exec(
    pathname,
  );
  return {
    year: params.get("year") || match?.[1] || null,
    entry: params.get("entry") || match?.[2] || null,
    award: params.get("award"),
  };
}
