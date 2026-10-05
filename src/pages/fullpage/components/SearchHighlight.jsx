export default function SearchHighlight({ text = "", query = "" }) {
  const value = String(text ?? "");
  const term = query.trim().replace(/^#/, "").toLowerCase();
  if (!term) return value;
  const parts = [];
  const lower = value.toLowerCase();
  let cursor = 0;
  let match = lower.indexOf(term);
  while (match !== -1) {
    parts.push(value.slice(cursor, match));
    parts.push(<mark className="search-highlight" key={match}>{value.slice(match, match + term.length)}</mark>);
    cursor = match + term.length;
    match = lower.indexOf(term, cursor);
  }
  parts.push(value.slice(cursor));
  return parts;
}
