// Drop indexes describe gaps in the original list, before the item is removed.
export function moveWorkspace(sessions, visibleIds, sourceId, targetId, edge = "before") {
  const from = visibleIds.indexOf(sourceId);
  const target = visibleIds.indexOf(targetId);
  if (from < 0 || target < 0 || sourceId === targetId) return null;
  const ids = [...visibleIds];
  const gap = target + (edge === "after" ? 1 : 0);
  ids.splice(from, 1);
  ids.splice(gap > from ? gap - 1 : gap, 0, sourceId);
  if (ids.every((id, index) => id === visibleIds[index])) return null;
  // Keep filtered-out workspaces in their original slots.
  const visible = new Set(visibleIds);
  const byId = new Map(sessions.map((session) => [session.id, session]));
  let index = 0;
  return sessions.map((session, order) => ({
    ...(visible.has(session.id) ? byId.get(ids[index++]) : session),
    order,
  }));
}

export function moveLink(sessions, selections, sourceId, sourceIndex, targetId, gap) {
  const source = sessions.find((session) => session.id === sourceId);
  const target = sessions.find((session) => session.id === targetId);
  if (!source?.tabs?.[sourceIndex] || !target) return null;
  const targetTabs = target.tabs || [];
  if (!Number.isInteger(gap) || gap < 0 || gap > targetTabs.length) return null;
  const same = sourceId === targetId;
  const insertAt = same && gap > sourceIndex ? gap - 1 : gap;
  if (same && insertAt === sourceIndex) return null;
  const selected = selections.get(sourceId)?.has(sourceIndex);
  const sourceTabs = [...source.tabs];
  const [tab] = sourceTabs.splice(sourceIndex, 1);
  const destinationTabs = same ? sourceTabs : [...targetTabs];
  destinationTabs.splice(insertAt, 0, tab);
  const nextSelections = new Map(selections);
  const remaining = [...(selections.get(sourceId) || [])]
    .filter((index) => index !== sourceIndex)
    .map((index) => index > sourceIndex ? index - 1 : index);
  const destinationSelection = new Set((same ? remaining : [...(selections.get(targetId) || [])])
    .map((index) => index >= insertAt ? index + 1 : index));
  if (selected) destinationSelection.add(insertAt);
  nextSelections.set(sourceId, new Set(remaining));
  nextSelections.set(targetId, destinationSelection);
  for (const id of [sourceId, targetId]) {
    if (!nextSelections.get(id)?.size) nextSelections.delete(id);
  }
  const updates = same
    ? [{ ...source, tabs: destinationTabs }]
    : [{ ...target, tabs: destinationTabs }, { ...source, tabs: sourceTabs }];
  return { updates, selections: nextSelections, tab, insertAt };
}
