import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
export type AppDirectories = {
  root: string;
  inbox: string;
  processing: string;
  review: string;
  done: string;
  error: string;
  assets: string;
  music: string;
  broll: string;
  brand: string;
  transcripts: string;
  plans: string;
  logs: string;
  db: string;
};
export async function ensureAppDirectories(
  root: string,
): Promise<AppDirectories> {
  root = resolve(root);
  const d = {
    root,
    inbox: join(root, "01_INBOX"),
    processing: join(root, "02_PROCESSING"),
    review: join(root, "03_REVIEW"),
    done: join(root, "04_DONE"),
    error: join(root, "ERROR"),
    assets: join(root, "assets"),
    music: join(root, "assets/music"),
    broll: join(root, "assets/b-roll"),
    brand: join(root, "brand"),
    transcripts: join(root, "cache/transcripts"),
    plans: join(root, "cache/plans"),
    logs: join(root, "logs"),
    db: join(root, "jobs.sqlite3"),
  };
  await Promise.all(
    Object.entries(d)
      .filter(([k]) => k !== "db")
      .map(([, p]) => mkdir(p, { recursive: true })),
  );
  await Promise.all(
    [
      "assets/a-roll",
      "assets/sfx",
      "brand/logo",
      "brand/fonts",
      "brand/reference",
      "cache/proxies",
    ].map((p) => mkdir(join(root, p), { recursive: true })),
  );
  return d;
}
