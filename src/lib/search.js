// Keep a note match visible even when it occurs well below the first line.
export function getNoteSearchExcerpt(note, query) {
  const value = String(note ?? "").trim();
  const term = String(query ?? "").trim().toLowerCase();
  if (!value || !term || term.startsWith("#")) return "";

  const match = value.toLowerCase().indexOf(term);
  if (match === -1) return "";

  const lineStart = match > 0 ? value.lastIndexOf("\n", match - 1) + 1 : 0;
  let start = Math.max(lineStart, match - 60);
  // Avoid starting partway through a word in long paragraphs.
  while (start < match && start > 0 && !/\s/.test(value[start - 1])) start++;

  const matchEnd = match + term.length;
  let end = Math.min(value.length, Math.max(start + 220, matchEnd + 80));
  while (end > matchEnd && end < value.length && !/\s/.test(value[end])) end--;

  return `${start > 0 ? "… " : ""}${value.slice(start, end).trim()}${end < value.length ? " …" : ""}`;
}
