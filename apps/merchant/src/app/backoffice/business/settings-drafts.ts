/** Reconcile against the last authoritative baseline, preserving local intent. */
export function reconcileDraft<T extends { revision: number }>(
  baseline: T,
  draft: T,
  remote: T,
) {
  const next = { ...remote };
  const overlaps: (keyof T)[] = [];
  for (const key of Object.keys(remote) as (keyof T)[]) {
    if (key === "revision") continue;
    const equal = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    if (!equal(draft[key], baseline[key])) {
      next[key] = draft[key];
      if (!equal(remote[key], baseline[key]) && !equal(remote[key], draft[key]))
        overlaps.push(key);
    }
  }
  return { draft: next, overlaps };
}
export function coherentRevisions(...sections: { revision: number }[]) {
  return sections.every((section) => section.revision === sections[0].revision);
}
