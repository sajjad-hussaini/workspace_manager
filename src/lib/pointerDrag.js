// In-popup dragging uses pointer events so it stays inside the popup window.
export function beginPointerDrag(event, { item, label, onStart, onTarget, onFinish }) {
  if (event.button !== 0 || event.isPrimary === false) return () => { };
  const source = event.currentTarget;
  const doc = source.ownerDocument;
  const win = doc.defaultView;
  const pointerId = event.pointerId;
  const origin = { x: event.clientX, y: event.clientY };
  let point = origin;
  let active = false;
  let done = false;
  let preview;
  let frame;
  let target = null;

  function locateTarget() {
    const hit = doc.elementFromPoint(point.x, point.y);
    const card = hit?.closest("[data-workspace-id]");
    let next = null;
    if (card) {
      const sessionId = card.dataset.workspaceId;
      if (item.type === "workspace") {
        const rect = card.getBoundingClientRect();
        next = { sessionId, edge: point.y > rect.top + rect.height / 2 ? "after" : "before" };
      } else {
        const row = hit.closest("[data-link-index]");
        const rect = row?.getBoundingClientRect();
        next = {
          sessionId, index: row
            ? Number(row.dataset.linkIndex) + (point.y > rect.top + rect.height / 2 ? 1 : 0)
            : Number(card.dataset.linkCount)
        };
      }
    }
    if (target?.sessionId !== next?.sessionId || target?.edge !== next?.edge || target?.index !== next?.index) {
      target = next;
      onTarget(next);
    }
  }

  function tick() {
    if (!active || done) return;
    const height = doc.documentElement.clientHeight;
    const width = doc.documentElement.clientWidth;
    preview.style.left = `${Math.max(8, Math.min(point.x + 12, width - preview.offsetWidth - 8))}px`;
    preview.style.top = `${Math.max(8, Math.min(point.y + 14, height - preview.offsetHeight - 8))}px`;
    if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height) {
      const edge = 48;
      const speed = point.y < edge ? -Math.ceil((edge - point.y) / 4)
        : point.y > height - edge ? Math.ceil((point.y - height + edge) / 4) : 0;
      if (speed) {
        let scrollable = source.parentElement;
        while (scrollable) {
          if (scrollable.scrollHeight > scrollable.clientHeight && /auto|scroll/.test(win.getComputedStyle(scrollable).overflowY)) break;
          scrollable = scrollable.parentElement;
        }
        (scrollable || doc.scrollingElement)?.scrollBy(0, speed);
      }
    }
    locateTarget();
    frame = win.requestAnimationFrame(tick);
  }

  function blockClick(click) {
    click.preventDefault();
    click.stopImmediatePropagation();
  }

  function finish(commit) {
    if (done) return;
    done = true;
    win.cancelAnimationFrame(frame);
    win.removeEventListener("pointermove", move);
    win.removeEventListener("pointerup", up);
    win.removeEventListener("pointercancel", cancel);
    win.removeEventListener("blur", cancel);
    win.removeEventListener("keydown", keydown);
    source.removeEventListener("lostpointercapture", cancel);
    if (source.hasPointerCapture?.(pointerId)) source.releasePointerCapture(pointerId);
    preview?.remove();
    doc.body.classList.remove("is-pointer-dragging");
    if (active) {
      // Swallow the click generated after release, so dragging never opens a link.
      doc.addEventListener("click", blockClick, true);
      win.setTimeout(() => doc.removeEventListener("click", blockClick, true), 0);
      onFinish(commit ? target : null);
    }
  }

  function move(moveEvent) {
    if (moveEvent.pointerId !== pointerId) return;
    point = { x: moveEvent.clientX, y: moveEvent.clientY };
    if (!active && Math.hypot(point.x - origin.x, point.y - origin.y) < 6) return;
    moveEvent.preventDefault();
    if (!active) {
      active = true;
      source.setPointerCapture?.(pointerId);
      doc.body.classList.add("is-pointer-dragging");
      preview = doc.createElement("div");
      preview.className = "modern-drag-preview";
      preview.textContent = `${item.type === "workspace" ? "Workspace" : "Link"} · ${label}`;
      doc.body.appendChild(preview);
      onStart();
      tick();
    }
  }

  function up(upEvent) {
    if (upEvent.pointerId !== pointerId) return;
    if (active) {
      point = { x: upEvent.clientX, y: upEvent.clientY };
      locateTarget();
      upEvent.preventDefault();
    }
    finish(true);
  }

  function cancel(cancelEvent) {
    if (cancelEvent?.pointerId != null && cancelEvent.pointerId !== pointerId) return;
    finish(false);
  }

  function keydown(keyEvent) {
    if (keyEvent.key === "Escape") { keyEvent.preventDefault(); cancel(); }
  }

  win.addEventListener("pointermove", move, { passive: false });
  win.addEventListener("pointerup", up);
  win.addEventListener("pointercancel", cancel);
  win.addEventListener("blur", cancel);
  win.addEventListener("keydown", keydown);
  source.addEventListener("lostpointercapture", cancel);
  return cancel;
}
