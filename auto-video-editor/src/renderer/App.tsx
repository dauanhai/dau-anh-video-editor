import React from "react";
import type { Job } from "../domain/job";
import type { AppSettings } from "../domain/settings";
declare global {
  interface Window {
    editorApi: {
      invoke: (method: string, args?: unknown) => Promise<any>;
      onChange: (cb: () => void) => () => void;
    };
  }
}
const labels: Record<string, string> = {
  discovered: "Video mới",
  validating: "Kiểm tra",
  transcribing: "Chép lời",
  planning: "Lập bản dựng",
  assembling: "Dựng",
  previewing: "Tạo bản xem trước",
  awaiting_review: "Chờ duyệt",
  rendering: "Đang xuất",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
export function App() {
  const [jobs, setJobs] = React.useState<Job[]>([]),
    [selected, setSelected] = React.useState<any>(null),
    [settings, setSettings] = React.useState<AppSettings | null>(null),
    [page, setPage] = React.useState("dashboard"),
    [error, setError] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [note, setNote] = React.useState("");
  const video = React.useRef<HTMLVideoElement>(null);
  async function refresh() {
    setJobs(await window.editorApi.invoke("listJobs"));
    if (selected)
      setSelected(await window.editorApi.invoke("getJob", { id: selected.id }));
  }
  React.useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    const off = window.editorApi.onChange(
      () => void refresh().catch((e) => setError(String(e))),
    );
    const timer = setInterval(
      () => void refresh().catch((e) => setError(String(e))),
      2000,
    );
    return () => {
      off();
      clearInterval(timer);
    };
  }, [selected?.id]);
  async function act(method: string, args: unknown) {
    setBusy(true);
    setError("");
    try {
      await window.editorApi.invoke(method, args);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function select(j: Job) {
    setSelected(await window.editorApi.invoke("getJob", { id: j.id }));
    setPage("review");
  }
  return (
    <div className="shell">
      <aside>
        <div className="logo">
          ĐẬU ÁNH <span>VIDEO EDITOR</span>
        </div>
        <p className="tagline">Từ video thô đến nội dung có dấu ấn.</p>
        <button
          className={page === "dashboard" ? "nav active" : "nav"}
          onClick={() => setPage("dashboard")}
        >
          Kho video
        </button>
        <button
          className="nav"
          onClick={async () => {
            setSettings(await window.editorApi.invoke("getSettings"));
            setPage("settings");
          }}
        >
          Cài đặt thương hiệu
        </button>
        <div className="aside-bottom">
          <p>Chạy trên máy của bạn</p>
          <button onClick={() => void act("openFolder", { folder: "inbox" })}>
            Mở thư mục đầu vào ↗
          </button>
          <button onClick={() => void act("openFolder", { folder: "done" })}>
            Mở video đã xuất ↗
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">STUDIO NỘI DUNG DU HỌC</p>
            <h1>
              {page === "settings"
                ? "Thiết lập một lần. Dựng đều mỗi ngày."
                : page === "review"
                  ? "Xem kỹ. Duyệt đúng. Xuất đẹp."
                  : "Video của bạn, sẵn sàng tỏa sáng."}
            </h1>
          </div>
          <span className="local">● Cục bộ · Duyệt trước khi xuất</span>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {page === "dashboard" && (
          <>
            <div className="stats">
              {[
                ["Video mới", ["discovered"]],
                [
                  "Đang xử lý",
                  [
                    "validating",
                    "transcribing",
                    "planning",
                    "assembling",
                    "previewing",
                  ],
                ],
                ["Chờ duyệt", ["awaiting_review"]],
                ["Đang xuất", ["rendering"]],
                [
                  "Hoàn thành / lỗi",
                  [
                    "completed",
                    "failed_input",
                    "failed_transcription",
                    "failed_planning",
                    "failed_preview",
                    "failed_render",
                  ],
                ],
              ].map(([title, statuses]) => (
                <div className="stat" key={title as string}>
                  <strong>
                    {
                      jobs.filter((j) =>
                        (statuses as string[]).includes(j.status),
                      ).length
                    }
                  </strong>
                  <span>{title}</span>
                </div>
              ))}
            </div>
            <section>
              <div className="section-title">
                <h2>Hàng đợi video</h2>
                <button
                  onClick={() => void act("openFolder", { folder: "inbox" })}
                >
                  + Thêm video vào thư mục
                </button>
              </div>
              {!jobs.length ? (
                <div className="empty">
                  <div className="empty-icon">▶</div>
                  <h2>Bắt đầu bằng video đầu tiên</h2>
                  <p>
                    Đưa video vào 01_INBOX. Ứng dụng nhận file khi chép xong,
                    <br />
                    dựng bản xem trước và chờ bạn duyệt.
                  </p>
                  <button
                    className="primary"
                    onClick={() => void act("openFolder", { folder: "inbox" })}
                  >
                    Mở thư mục đầu vào
                  </button>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Video</th>
                      <th>Trạng thái</th>
                      <th>Thời lượng</th>
                      <th>Nhận lúc</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <strong>{j.originalName}</strong>
                          <small>
                            {j.error ??
                              (j.checkpoint.plan?.preset.id || "Chuyên gia")}
                          </small>
                        </td>
                        <td>
                          <span className={"badge " + j.status}>
                            {labels[j.status] ?? "Cần xử lý lỗi"}
                          </span>
                        </td>
                        <td>
                          {j.checkpoint.media
                            ? Math.round(j.checkpoint.media.durationMs / 1000) +
                              "s"
                            : "—"}
                        </td>
                        <td>{new Date(j.createdAt).toLocaleString("vi-VN")}</td>
                        <td>
                          <button onClick={() => void select(j)}>
                            Xem chi tiết →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        )}
        {page === "review" && selected && (
          <div className="review-grid">
            <section>
              <h2>{selected.originalName}</h2>
              {selected.previewUrl ? (
                <video
                  ref={video}
                  controls
                  src={selected.outputUrl || selected.previewUrl}
                />
              ) : (
                <div className="empty">Chưa có bản xem trước.</div>
              )}
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy || selected.status !== "awaiting_review"}
                  onClick={() =>
                    void act("approveJob", {
                      id: selected.id,
                      revision: selected.checkpoint.plan.revision,
                    })
                  }
                >
                  Duyệt & Xuất MP4
                </button>
                <button
                  disabled={busy || selected.status !== "awaiting_review"}
                  onClick={() =>
                    void act("reviseJob", {
                      id: selected.id,
                      command: "reduce-effects",
                    })
                  }
                >
                  Giảm hiệu ứng
                </button>
                <button
                  disabled={busy || selected.status !== "awaiting_review"}
                  onClick={() =>
                    void act("reviseJob", {
                      id: selected.id,
                      command: "change-music",
                    })
                  }
                >
                  Bỏ nhạc nền
                </button>
                {selected.status.startsWith("failed_") && (
                  <button
                    disabled={busy}
                    onClick={() => void act("retryJob", { id: selected.id })}
                  >
                    Thử lại
                  </button>
                )}
              </div>
              <p className="muted">
                Bản xuất sử dụng đúng phiên bản đã duyệt. Kiểm tra tên riêng, số
                liệu và nội dung tư vấn trước khi xuất.
              </p>
              {selected.checkpoint.plan?.warnings.map((w: string) => (
                <p className="warning" key={w}>
                  {w === "NO_AUDIO_TRACK"
                    ? "Video không có tiếng — không tạo phụ đề."
                    : w.startsWith("PERSONAL_DATA")
                      ? "Có dấu hiệu dữ liệu cá nhân trong lời nói. Hãy kiểm tra trước khi chia sẻ."
                      : w}
                </p>
              ))}
              <textarea
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú để người dựng hiệu chỉnh; không tự thêm nội dung vào video."
              />
              <button
                disabled={
                  busy || selected.status !== "awaiting_review" || !note
                }
                onClick={() =>
                  void act("reviseJob", {
                    id: selected.id,
                    command: "custom-note",
                    note,
                  })
                }
              >
                Lưu ghi chú
              </button>
            </section>
            <section>
              <h2>Lời thoại</h2>
              <div className="transcript">
                {selected.checkpoint.plan?.captions.map((c: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (video.current)
                        video.current.currentTime = c.startMs / 1000;
                    }}
                  >
                    <time>{(c.startMs / 1000).toFixed(1)}s</time>
                    {c.text}
                  </button>
                )) ?? <p>Chưa có lời thoại.</p>}
              </div>
              <h2>Nhật ký trạng thái</h2>
              <div className="events">
                {selected.events?.map((e: any, i: number) => (
                  <p key={i}>
                    {new Date(e.at).toLocaleTimeString("vi-VN")} ·{" "}
                    {JSON.parse(e.event).status ?? "Thử lại"}
                  </p>
                ))}
              </div>
            </section>
          </div>
        )}
        {page === "settings" && settings && (
          <section className="settings">
            <h2>Nhận diện và preset</h2>
            <label>
              Tên thương hiệu
              <input
                value={settings.brand.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: { ...settings.brand, name: e.target.value },
                  })
                }
              />
            </label>
            <label>
              CTA cố định
              <input
                value={settings.brand.cta}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: { ...settings.brand, cta: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Màu nhận diện
              <input
                type="color"
                value={settings.brand.color}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: { ...settings.brand, color: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Logo — đường dẫn trong thư mục dữ liệu
              <input
                value={settings.brand.logo ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: {
                      ...settings.brand,
                      logo: e.target.value || undefined,
                    },
                  })
                }
              />
            </label>
            <label>
              Tên font
              <input
                value={settings.brand.font}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: { ...settings.brand, font: e.target.value },
                  })
                }
              />
            </label>
            <label>
              File font — để trống dùng font hệ thống
              <input
                value={settings.brand.fontFile ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    brand: {
                      ...settings.brand,
                      fontFile: e.target.value || undefined,
                    },
                  })
                }
              />
            </label>
            <label>
              Preset
              <select
                value={settings.preset}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    preset: e.target.value as AppSettings["preset"],
                  })
                }
              >
                <option value="expert">Chuyên gia</option>
                <option value="viral-education">Viral giáo dục</option>
                <option value="student-story">Câu chuyện học viên</option>
              </select>
            </label>
            {(["watch", "autostart", "notifications"] as const).map(
              (key, i) => (
                <label className="check" key={key}>
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: e.target.checked })
                    }
                  />
                  {
                    [
                      "Tự nhận video từ thư mục",
                      "Khởi động cùng Windows",
                      "Thông báo khi xuất xong",
                    ][i]
                  }
                </label>
              ),
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={() => void act("saveSettings", settings)}
            >
              Lưu cài đặt
            </button>
            <p className="muted">
              Đặt nhạc trong assets/music; cảnh trám trong assets/b-roll, kèm
              file .json có tags. Không tải tư liệu Internet tự động.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
