import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { safeExisting } from "../filesystem/atomic-file";
export class MediaServer {
  private server: Server | null = null;
  private files = new Map<string, string>();
  private base = "";
  constructor(private root: string) {}
  async start() {
    this.server = createServer(async (req, res) => {
      try {
        const path = this.files.get((req.url ?? "").split("?")[0]);
        if (!path) {
          res.writeHead(404).end();
          return;
        }
        const safe = await safeExisting(this.root, path),
          s = await stat(safe);
        const types: Record<string, string> = {
          ".mp4": "video/mp4",
          ".mov": "video/quicktime",
          ".mp3": "audio/mpeg",
          ".wav": "audio/wav",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".ttf": "font/ttf",
          ".otf": "font/otf",
          ".m4v": "video/mp4",
        };
        res.setHeader(
          "Content-Type",
          types[extname(safe)] ?? "application/octet-stream",
        );
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Access-Control-Allow-Origin", "*");
        let start = 0,
          end = s.size - 1;
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
        if (match) {
          start = Number(match[1]);
          end = match[2] ? Math.min(Number(match[2]), end) : end;
          if (start > end) {
            res.writeHead(416).end();
            return;
          }
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${s.size}`);
        }
        res.setHeader("Content-Length", end - start + 1);
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        const stream = createReadStream(safe, { start, end });
        stream.on("error", () => res.destroy());
        req.on("close", () => stream.destroy());
        stream.pipe(res);
      } catch {
        res.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, "127.0.0.1", () => resolve()),
    );
    const address = this.server.address();
    if (!address || typeof address === "string")
      throw new Error("MEDIA_SERVER_FAILED");
    this.base = `http://127.0.0.1:${address.port}`;
    return this.base;
  }
  async url(file: string) {
    const safe = await safeExisting(this.root, file);
    for (const [token, path] of this.files)
      if (path === safe) return this.base + token;
    const token = "/" + randomBytes(24).toString("hex") + extname(file);
    this.files.set(token, safe);
    return this.base + token;
  }
  async stop() {
    await new Promise<void>((r) => {
      if (!this.server) return r();
      this.server.close(() => r());
      this.server.closeAllConnections();
    });
    this.files.clear();
  }
}
