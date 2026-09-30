import test from "node:test";
import assert from "node:assert/strict";
import { beginPointerDrag } from "./pointerDrag.js";

function events() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    emit(type, props = {}) {
      const event = { pointerId: 1, clientX: 50, clientY: 100, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...props };
      for (const listener of [...(listeners.get(type) || [])]) listener(event);
      return event;
    },
    count(type) { return listeners.get(type)?.size || 0; },
  };
}

function setup(item = { type: "workspace", sessionId: "a" }) {
  let nextFrame;
  let hit = null;
  const timers = [];
  const finished = [];
  const targets = [];
  let started = 0;
  let scrolled = 0;
  let removed = false;
  const win = { ...events(), requestAnimationFrame(fn) { nextFrame = fn; return 1; }, cancelAnimationFrame() { nextFrame = null; }, setTimeout(fn) { timers.push(fn); }, getComputedStyle() { return { overflowY: "auto" }; } };
  const body = { classList: { add() {}, remove() {} }, appendChild() {}, scrollHeight: 1200, clientHeight: 600, scrollBy(x, y) { scrolled += y; } };
  const doc = { ...events(), defaultView: win, body, documentElement: { clientWidth: 440, clientHeight: 600 }, elementFromPoint() { return hit; }, createElement() { return { style: {}, offsetWidth: 160, offsetHeight: 40, remove() { removed = true; } }; } };
  const source = { ...events(), ownerDocument: doc, parentElement: body, setPointerCapture() { this.captured = true; }, hasPointerCapture() { return this.captured; }, releasePointerCapture() { this.captured = false; } };
  const cancel = beginPointerDrag({ currentTarget: source, button: 0, pointerId: 1, clientX: 50, clientY: 100 }, {
    item, label: "Example", onStart() { started++; }, onTarget(target) { targets.push(target); }, onFinish(target) { finished.push(target); },
  });
  return {
    win, doc, source, cancel, finished, targets,
    get started() { return started; }, get scrolled() { return scrolled; }, get removed() { return removed; },
    frame() { nextFrame?.(); }, flushTimers() { timers.forEach((fn) => fn()); },
    target(sessionId, rowIndex, top = 150, height = 50) {
      const card = { dataset: { workspaceId: sessionId, linkCount: "3" }, getBoundingClientRect: () => ({ top, height }) };
      const row = rowIndex == null ? null : { dataset: { linkIndex: String(rowIndex) }, getBoundingClientRect: () => ({ top, height }) };
      hit = { closest(selector) { return selector === "[data-workspace-id]" ? card : row; } };
    },
    outside() { hit = null; },
  };
}

test("ordinary clicks do not start a drag or suppress their action", () => {
  const drag = setup();
  drag.win.emit("pointermove", { clientY: 103 });
  drag.win.emit("pointerup", { clientY: 103 });
  assert.equal(drag.started, 0);
  assert.equal(drag.finished.length, 0);
  assert.equal(drag.doc.count("click"), 0);
  assert.equal(drag.win.count("pointermove"), 0);
});

test("workspace drag tracks a drop edge, releases capture, and suppresses the release click", () => {
  const drag = setup();
  drag.target("b");
  drag.win.emit("pointermove", { clientY: 160 });
  assert.equal(drag.started, 1);
  assert.equal(drag.source.captured, true);
  assert.deepEqual(drag.targets.at(-1), { sessionId: "b", edge: "before" });
  drag.win.emit("pointerup", { clientY: 195 });
  assert.deepEqual(drag.finished, [{ sessionId: "b", edge: "after" }]);
  assert.equal(drag.source.captured, false);
  assert.equal(drag.removed, true);
  assert.equal(drag.doc.emit("click").prevented, true);
  drag.flushTimers();
  assert.equal(drag.doc.count("click"), 0);
});

test("link drops resolve row gaps and collapsed workspace destinations", () => {
  const drag = setup({ type: "link", sessionId: "a", index: 0 });
  drag.target("a", 1);
  drag.win.emit("pointermove", { clientY: 190 });
  assert.deepEqual(drag.targets.at(-1), { sessionId: "a", index: 2 });
  drag.target("b");
  drag.win.emit("pointerup", { clientY: 190 });
  assert.deepEqual(drag.finished, [{ sessionId: "b", index: 3 }]);
});

test("release outside a workspace clears the last target", () => {
  const drag = setup();
  drag.target("b");
  drag.win.emit("pointermove", { clientY: 170 });
  drag.outside();
  drag.win.emit("pointerup");
  assert.deepEqual(drag.finished, [null]);
});

test("Escape, cancellation, lost capture and window blur never commit a move", () => {
  for (const type of ["keydown", "pointercancel", "blur", "lostpointercapture"]) {
    const drag = setup();
    drag.target("b");
    drag.win.emit("pointermove", { clientY: 180 });
    (type === "lostpointercapture" ? drag.source : drag.win).emit(type, { key: "Escape" });
    assert.deepEqual(drag.finished, [null], type);
    assert.equal(drag.win.count("pointermove"), 0);
    assert.equal(drag.removed, true);
  }
});

test("dragging near the popup edge scrolls its actual scroll container", () => {
  const drag = setup();
  drag.win.emit("pointermove", { clientY: 590 });
  const firstScroll = drag.scrolled;
  assert.ok(firstScroll > 0);
  drag.frame();
  assert.ok(drag.scrolled > firstScroll);
  drag.cancel();
});

test("a second pointer cannot finish or reposition an active drag", () => {
  const drag = setup();
  drag.target("b");
  drag.win.emit("pointermove", { clientY: 180 });
  drag.win.emit("pointerup", { pointerId: 2 });
  assert.equal(drag.finished.length, 0);
  drag.cancel();
  assert.deepEqual(drag.finished, [null]);
});
