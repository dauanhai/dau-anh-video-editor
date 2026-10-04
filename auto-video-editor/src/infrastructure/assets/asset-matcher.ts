export type Asset = { file: string; tags: string[]; durationMs: number };
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
export function matchAssets(query: string, assets: Asset[]) {
  let q = normalize(query);
  for (const [vi, en] of [
    ["ky tuc xa", "dormitory"],
    ["dai loan", "taiwan"],
    ["truong hoc", "campus"],
    ["hoc bong", "scholarship"],
  ])
    q = q.replaceAll(vi, en);
  const tokens = new Set(q.split(/[^a-z0-9]+/));
  return assets
    .map((a) => ({
      ...a,
      score:
        a.tags.filter((t) => tokens.has(normalize(t))).length /
        Math.max(1, a.tags.length),
    }))
    .filter((a) => a.score >= 0.65)
    .sort((a, b) => b.score - a.score);
}
