import { useId, useState } from "react";
import { parseTags } from "../../../lib/tags";
import { Icon } from "./Icons";
import "./TagInput.css";

export default function TagInput({ value, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const tags = parseTags(value);

  function commit() {
    onChange(parseTags([...tags, ...parseTags(draft)]).join(", "));
    setDraft("");
  }

  return (
    <div className="tag-input-field">
      <label htmlFor={id}>Tags <span>(optional)</span></label>
      <div className="tag-input-box">
        {tags.map((tag) => <span className="tag-input-chip" key={tag.toLowerCase()}>
          <span>#{tag}</span>
          <button type="button" aria-label={`Remove tag ${tag}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onChange(tags.filter((item) => item !== tag).join(", "))}>
            <Icon name="close" />
          </button>
        </span>)}
        <input id={id} value={draft} placeholder={tags.length ? "Add tag…" : "Add a tag…"}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              commit();
            }
          }} />
      </div>
      <p className="tag-input-hint" id={`${id}-hint`}>Press Enter or leave the field to add. Use commas for multiple tags.</p>
    </div>
  );
}
