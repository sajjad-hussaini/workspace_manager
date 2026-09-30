import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function TagList({ tags = [], className = "", label = "Tags" }) {
  const items = tags.filter((tag) => typeof tag === "string" && tag.trim());
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  const groupRef = useRef(null);
  const anchorRef = useRef(null);
  const popoverRef = useRef(null);
  const closeTimer = useRef(null);
  const id = useId();

  function keepOpen() {
    clearTimeout(closeTimer.current);
  }

  function show(event, next) {
    keepOpen();
    anchorRef.current = event.currentTarget;
    if (active !== next) setPosition(null);
    setActive(next);
  }

  function closeSoon() {
    keepOpen();
    closeTimer.current = setTimeout(() => {
      if (groupRef.current?.contains(document.activeElement) || groupRef.current?.matches(":hover") || popoverRef.current?.matches(":hover")) return;
      setActive(null);
    }, 140);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!active) return;
    function dismiss(event) {
      if (!groupRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setActive(null);
    }
    function escape(event) {
      if (event.key === "Escape") setActive(null);
    }
    function scroll(event) {
      if (!popoverRef.current?.contains(event.target)) setActive(null);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", scroll);
    document.addEventListener("dragstart", scroll);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", scroll);
      document.removeEventListener("dragstart", scroll);
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!active || !popoverRef.current || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const popover = popoverRef.current.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const below = anchor.bottom + 6;
    setPosition({
      left: Math.max(8, Math.min(anchor.right - popover.width, width - popover.width - 8)),
      top: Math.max(8, below + popover.height <= height - 8 ? below : anchor.top - popover.height - 6),
    });
  }, [active, tags]);

  if (!items.length) return null;
  const visibleTags = active === "more" ? items.slice(1) : [items[0]];
  const triggerProps = (name) => ({
    type: "button",
    "aria-describedby": active === name ? id : undefined,
    onPointerEnter: (event) => show(event, name),
    onFocus: (event) => show(event, name),
    onClick: (event) => { event.stopPropagation(); show(event, name); },
  });

  return (
    <span
      ref={groupRef}
      className={`modern-tag-list ${className}`}
      aria-label={label}
      onPointerLeave={closeSoon}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSoon(); }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") setActive(null);
      }}
    >
      <button className="modern-tag-chip" {...triggerProps("first")}>{items[0]}</button>
      {items.length > 1 && (
        <button className="modern-tag-more" aria-label={`${items.length - 1} more tags`} {...triggerProps("more")}>
          +{items.length - 1}
        </button>
      )}
      {active && createPortal(
        <div
          ref={popoverRef}
          id={id}
          role="tooltip"
          className="modern-tags-popover"
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
          onPointerEnter={keepOpen}
          onPointerLeave={closeSoon}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="modern-tags-popover-heading">TAGS</span>
          <ul>{visibleTags.map((tag, index) => <li key={index}>{tag}</li>)}</ul>
        </div>,
        document.body
      )}
    </span>
  );
}
