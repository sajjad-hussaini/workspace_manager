import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatReminderDate } from "../../../lib/reminders";
import { Icon } from "./Icons";
import "./TabIndicators.css";

function Indicator({ icon, label, children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const tooltip = useRef(null);
  const closeTimer = useRef(null);
  const id = useId();

  function keepOpen() { clearTimeout(closeTimer.current); }
  function show() {
    keepOpen();
    if (!open) setPosition(null);
    setOpen(true);
  }
  function closeSoon() {
    keepOpen();
    closeTimer.current = setTimeout(() => {
      if (trigger.current === document.activeElement || tooltip.current?.contains(document.activeElement)) return;
      setOpen(false);
    }, 140);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (!tooltip.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    }
    function escape(event) { if (event.key === "Escape") setOpen(false); }
    function close() { setOpen(false); }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", dismiss, true);
    document.addEventListener("dragstart", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", dismiss, true);
      document.removeEventListener("dragstart", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !tooltip.current || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const box = tooltip.current.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    setPosition({
      left: Math.max(8, Math.min(anchor.right - box.width, width - box.width - 8)),
      top: Math.max(8, anchor.bottom + 6 + box.height <= height - 8 ? anchor.bottom + 6 : anchor.top - box.height - 6),
    });
  }, [open, children]);

  return <>
    <button ref={trigger} type="button" className="tab-indicator" aria-label={label}
      aria-describedby={open ? id : undefined}
      onPointerEnter={show} onPointerLeave={closeSoon} onFocus={show} onBlur={closeSoon}
      onClick={(event) => { event.stopPropagation(); show(); }}>
      <Icon name={icon} />
    </button>
    {open && createPortal(<div ref={tooltip} id={id} role="tooltip" className="tab-indicator-tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      onPointerEnter={keepOpen} onPointerLeave={closeSoon}
      onFocus={keepOpen} onBlur={closeSoon}>
      <strong>{label}</strong>
      <div>{children}</div>
    </div>, document.body)}
  </>;
}

export default function TabIndicators({ tab }) {
  const note = typeof tab.note === "string" ? tab.note.trim() : "";
  const hasReminder = Number.isFinite(Date.parse(tab.reminderAt));
  if (!note && !hasReminder) return null;

  return <span className="tab-indicators" onPointerDown={(event) => event.stopPropagation()}>
    {note && <Indicator icon="note" label="Note">{note}</Indicator>}
    {hasReminder && <Indicator icon="reminderbell" label="Reminder">{formatReminderDate(tab.reminderAt)}</Indicator>}
  </span>;
}
