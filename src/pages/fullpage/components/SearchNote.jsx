import { getNoteSearchExcerpt } from "../../../lib/search";
import SearchHighlight from "./SearchHighlight";

export default function SearchNote({ note, query }) {
  const excerpt = getNoteSearchExcerpt(note, query);
  if (!excerpt) return null;

  return <p className="search-note">
    <span className="search-note-label">Note: </span>
    <SearchHighlight text={excerpt} query={query} />
  </p>;
}
