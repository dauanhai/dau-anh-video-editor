import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { bootstrap, type EditorBackend } from "../../src/main/bootstrap";
import { handleRequest } from "../../src/main/request-handler";
import { within } from "../../src/infrastructure/filesystem/atomic-file";
import "../environment";
let backend: EditorBackend, host: Server, base: string, root: string;
test.beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "editor-e2e-"));
  backend = await bootstrap(root, resolve("."));
  host = createServer(async (req, res) => {
    try {
      if (req.url === "/api" && req.method === "POST") {
        let body = "";
        for await (const c of req) body += c;
        const value = await handleRequest(backend, JSON.parse(body), {
          openFolder: async () => "",
          autostart: () => {},
        });
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ value: value ?? null }));
        return;
      }
      const path = resolve(
        "out/renderer",
        "." + (req.url === "/" ? "/index.html" : req.url),
      );
      if (!within(resolve("out/renderer"), path)) throw new Error("BAD_PATH");
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
      };
      res.setHeader(
        "Content-Type",
        types[extname(path)] || "application/octet-stream",
      );
      res.end(await readFile(path));
    } catch (e) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
  await new Promise<void>((r) => host.listen(0, "127.0.0.1", r));
  const a = host.address() as any;
  base = `http://127.0.0.1:${a.port}`;
});
test.afterAll(async () => {
  await backend.close();
  await new Promise<void>((r) => host.close(() => r()));
});
test("real backend: watch silent source, review current revision, export MP4", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).editorApi = {
      invoke: async (method: string, args: unknown = {}) => {
        const r = await fetch("/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, args }),
        });
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        return d.value;
      },
      onChange: () => () => {},
    };
  });
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Video của bạn, sẵn sàng tỏa sáng." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=purple:s=160x240:r=30",
    "-t",
    "1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    join(root, "01_INBOX", "demo.mp4"),
  ]);
  await expect(page.getByText("Chờ duyệt", { exact: true }).last()).toBeVisible(
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Xem chi tiết →" }).click();
  await expect(
    page.getByRole("button", { name: "Duyệt & Xuất MP4" }),
  ).toBeEnabled();
  await expect(
    page.getByText("Video không có tiếng — không tạo phụ đề."),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/review.png", fullPage: true });
  await page.getByRole("button", { name: "Giảm hiệu ứng" }).click();
  await expect(
    page.getByRole("button", { name: "Duyệt & Xuất MP4" }),
  ).toBeEnabled({ timeout: 90000 });
  await page.getByRole("button", { name: "Duyệt & Xuất MP4" }).click();
  await expect
    .poll(() => backend.repo.list()[0]?.status, { timeout: 90000 })
    .toBe("completed");
  const j = backend.repo.list()[0];
  expect(j.checkpoint.outputRevision).toBe(j.checkpoint.plan.revision);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-i",
    j.checkpoint.outputPath,
    "-f",
    "null",
    "-",
  ]);
  await page.getByRole("button", { name: "Cài đặt thương hiệu" }).click();
  await page.getByLabel("Tên thương hiệu").fill("Đậu Ánh AI");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect.poll(() => backend.settings.value.brand.name).toBe("Đậu Ánh AI");
});
