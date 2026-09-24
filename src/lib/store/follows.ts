import { readJson, updateJson } from "./jsonStore";

interface Follow {
  userId: string;
  templeSlug: string;
  at: string;
}

const FILE = "follows.json";

export function followedTemples(userId: string): string[] {
  return readJson<Follow[]>(FILE, []).filter((f) => f.userId === userId).map((f) => f.templeSlug);
}

export function isFollowing(userId: string, templeSlug: string): boolean {
  return followedTemples(userId).includes(templeSlug);
}

export function setFollow(userId: string, templeSlug: string, follow: boolean): void {
  updateJson<Follow[]>(FILE, [], (all) => {
    const rest = all.filter((f) => !(f.userId === userId && f.templeSlug === templeSlug));
    return follow ? [...rest, { userId, templeSlug, at: new Date().toISOString() }] : rest;
  });
}
