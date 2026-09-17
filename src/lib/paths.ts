/**
 * Dotted-path access for the Temple object, used wherever FieldSpec.path
 * has to be resolved generically — the Excel importer/exporter, the
 * contributor form and the validator all address fields by path.
 */

type Bag = Record<string, unknown>;

export function getPath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of path.split(".")) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Bag)[key];
  }
  return current;
}

/** Sets `path` on `root`, creating intermediate objects as needed. */
export function setPath(root: Bag, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  let current: Bag = root;
  for (const key of keys) {
    const next = current[key];
    if (next === null || next === undefined || typeof next !== "object") {
      current[key] = {};
    }
    current = current[key] as Bag;
  }
  current[last] = value;
}
