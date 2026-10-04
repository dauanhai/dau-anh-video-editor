# Auto Video Editor Du Học Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây ứng dụng Windows chạy cục bộ, tự nhận video từ thư mục, tạo bản dựng Remotion theo preset du học, cho khách duyệt và xuất MP4.

**Architecture:** Electron cung cấp desktop shell và tiến trình nền; React hiển thị dashboard và màn hình duyệt; SQLite lưu hàng đợi và checkpoint. Pipeline Node xử lý ingest, metadata, transcription, planning, asset matching và QC; Remotion nhận `EditPlan` đã kiểm định để tạo preview và render cuối cùng.

**Tech Stack:** Electron, React, TypeScript, Vite, Remotion 4, FFmpeg, Mediabunny, SQLite, Chokidar, Zod, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-04-auto-video-editor-du-hoc-windows-design.md`

## Global Constraints

- Nền tảng mục tiêu là Windows; MVP phục vụ một khách hàng tư vấn du học.
- Video đầu ra mặc định là 9:16, 1080 × 1920, 30fps.
- Luồng mặc định là tạo preview, chờ duyệt, rồi mới render MP4.
- Render chạy cục bộ bằng Remotion; video nguồn và đầu ra mặc định không rời máy khách.
- Mỗi clip có thể chỉnh độc lập phải có JSX node riêng trong timeline Remotion.
- Animation dùng `useCurrentFrame()`, `interpolate()` và easing; không dùng CSS animation/transition.
- Caption tuân theo kiểu `Caption` của `@remotion/captions`.
- Không tự thêm cam kết visa, học bổng, học phí, tỷ lệ thành công hoặc chính sách tuyển sinh.
- Kết quả transcription và edit plan được cache theo checksum và phiên bản preset.
- Không xóa video nguồn tự động trong MVP.
- Mỗi job chỉ chạy một render đồng thời theo mặc định.
- Mọi thời gian trong hợp đồng dữ liệu dùng milliseconds; lớp Remotion chịu trách nhiệm đổi sang frame.

## Review Focus

1. File đang được sao chép dở phải được giữ ở `01_INBOX`, không tạo job cho đến khi ổn định.
2. Hai file cùng nội dung nhưng khác tên phải được nhận diện là trùng và liên kết với job cũ.
3. Khởi động lại ứng dụng giữa lúc xử lý phải tiếp tục từ checkpoint hợp lệ, không chạy lại transcription đã cache.
4. Video không có audio phải tạo được job và preview hình ảnh, đồng thời hiển thị cảnh báo caption không khả dụng.
5. Ổ đĩa không đủ chỗ phải dừng nhận job/render mới, giữ nguyên dữ liệu và đưa ra thông báo có thể hành động.

---

## File Structure

```text
auto-video-editor/
  package.json
  pnpm-lock.yaml
  electron.vite.config.ts
  tsconfig.json
  src/
    main/
      main.ts
      bootstrap.ts
      ipc.ts
      windows.ts
    preload/
      index.ts
      api.ts
    renderer/
      App.tsx
      routes.tsx
      pages/DashboardPage.tsx
      pages/ReviewPage.tsx
      pages/SettingsPage.tsx
      components/JobTable.tsx
      components/PreviewPlayer.tsx
      components/StatusBadge.tsx
    domain/
      job.ts
      edit-plan.ts
      preset.ts
      settings.ts
      errors.ts
    infrastructure/
      db/client.ts
      db/migrations/001_initial.sql
      db/job-repository.ts
      filesystem/app-directories.ts
      filesystem/file-fingerprint.ts
      filesystem/inbox-watcher.ts
      media/media-inspector.ts
      media/silence-detector.ts
      transcription/transcription-engine.ts
      transcription/cached-transcription-engine.ts
      transcription/provider.ts
      planning/content-planner.ts
      planning/edit-plan-cache.ts
      assets/asset-indexer.ts
      assets/asset-matcher.ts
      render/preview-service.ts
      render/render-service.ts
      render/remotion-bundle.ts
      qc/quality-checker.ts
      security/secret-store.ts
      notifications/windows-notifier.ts
    pipeline/
      job-runner.ts
      job-state-machine.ts
      ingest-service.ts
      recovery-service.ts
    remotion/
      index.ts
      Root.tsx
      AutoEditComposition.tsx
      scenes/ARollScene.tsx
      scenes/BRollScene.tsx
      layers/CaptionLayer.tsx
      layers/KeywordHighlight.tsx
      layers/BrandLayer.tsx
      layers/AudioLayer.tsx
      transitions/transition-factory.tsx
    shared/
      ipc-contract.ts
      result.ts
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  resources/
    default-presets/
    default-brand/
  scripts/
    verify-windows-package.mjs
```

## Task 1: Scaffold và hợp đồng miền

**Files:**
- Create: `auto-video-editor/package.json`
- Create: `auto-video-editor/electron.vite.config.ts`
- Create: `auto-video-editor/tsconfig.json`
- Create: `auto-video-editor/src/domain/job.ts`
- Create: `auto-video-editor/src/domain/edit-plan.ts`
- Create: `auto-video-editor/src/domain/preset.ts`
- Create: `auto-video-editor/src/domain/settings.ts`
- Create: `auto-video-editor/src/shared/result.ts`
- Test: `auto-video-editor/tests/unit/domain/edit-plan.test.ts`

**Interfaces:**
- Consumes: Không có.
- Produces: `Job`, `JobStatus`, `EditPlan`, `EditSegment`, `Preset`, `AppSettings`, `Result<T, E>` và các Zod schema tương ứng.

- [ ] **Step 1: Viết kiểm thử thất bại cho hợp đồng `EditPlan`**

Kiểm thử `editPlanSchema` chấp nhận composition 1080 × 1920, 30fps với thời gian milliseconds; từ chối segment âm, segment kết thúc trước khi bắt đầu, preset thiếu version và caption thiếu `startMs`/`endMs`.

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/domain/edit-plan.test.ts`

Expected: FAIL vì module `src/domain/edit-plan.ts` chưa tồn tại.

- [ ] **Step 3: Scaffold dự án và triển khai các schema miền tối thiểu**

Định nghĩa chính xác:

```ts
export type JobStatus =
  | 'discovered' | 'validating' | 'transcribing' | 'planning'
  | 'assembling' | 'previewing' | 'awaiting_review' | 'rendering'
  | 'completed' | 'blocked_missing_asset' | 'failed_input'
  | 'failed_transcription' | 'failed_planning' | 'failed_preview'
  | 'failed_render' | 'cancelled';

export const editPlanSchema: z.ZodType<EditPlan>;
export const presetSchema: z.ZodType<Preset>;
export const appSettingsSchema: z.ZodType<AppSettings>;
```

Khóa mặc định video ở `width=1080`, `height=1920`, `fps=30` trong preset mặc định, không hard-code vào schema để giữ khả năng đọc bản kế hoạch cũ.

- [ ] **Step 4: Chạy typecheck và unit test**

Run: `cd auto-video-editor && pnpm typecheck && pnpm vitest run tests/unit/domain/edit-plan.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add auto-video-editor
git commit -m "feat: scaffold editor domain contracts"
```

## Task 2: Thư mục ứng dụng và dấu vân tay file

**Files:**
- Create: `auto-video-editor/src/infrastructure/filesystem/app-directories.ts`
- Create: `auto-video-editor/src/infrastructure/filesystem/file-fingerprint.ts`
- Test: `auto-video-editor/tests/unit/filesystem/app-directories.test.ts`
- Test: `auto-video-editor/tests/unit/filesystem/file-fingerprint.test.ts`

**Interfaces:**
- Consumes: `AppSettings` từ Task 1.
- Produces: `ensureAppDirectories(root: string): Promise<AppDirectories>` và `fingerprintFile(path: string): Promise<FileFingerprint>`.

- [ ] **Step 1: Viết kiểm thử thất bại cho cấu trúc thư mục**

Assert `ensureAppDirectories()` tạo đủ `01_INBOX`, `02_PROCESSING`, `03_REVIEW`, `04_DONE`, `ERROR`, `assets/*`, `brand/*`, `cache/*` và `logs`; gọi hai lần không xóa file đang có.

- [ ] **Step 2: Viết kiểm thử thất bại cho fingerprint**

Assert hai file cùng bytes nhưng khác tên có cùng SHA-256; file khác bytes có checksum khác.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/filesystem`

Expected: FAIL vì hai module chưa tồn tại.

- [ ] **Step 4: Triển khai hai giao diện**

```ts
export async function ensureAppDirectories(root: string): Promise<AppDirectories>;
export async function fingerprintFile(path: string): Promise<{
  sha256: string;
  sizeBytes: number;
  modifiedAtMs: number;
}>;
```

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/filesystem`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/filesystem auto-video-editor/tests/unit/filesystem
git commit -m "feat: add editor directories and file fingerprints"
```

## Task 3: SQLite job repository và state machine

**Files:**
- Create: `auto-video-editor/src/infrastructure/db/client.ts`
- Create: `auto-video-editor/src/infrastructure/db/migrations/001_initial.sql`
- Create: `auto-video-editor/src/infrastructure/db/job-repository.ts`
- Create: `auto-video-editor/src/pipeline/job-state-machine.ts`
- Test: `auto-video-editor/tests/unit/pipeline/job-state-machine.test.ts`
- Test: `auto-video-editor/tests/integration/db/job-repository.test.ts`

**Interfaces:**
- Consumes: `Job`, `JobStatus`, `FileFingerprint`.
- Produces: `JobRepository` và `transitionJob(current, next)`.

- [ ] **Step 1: Viết kiểm thử thất bại cho chuyển trạng thái**

Assert luồng hợp lệ đi từ `discovered` đến `completed`; từ chối `discovered → rendering`, `completed → planning`; cho phép retry từ `failed_render → rendering`.

- [ ] **Step 2: Viết kiểm thử repository**

Assert `create`, `findById`, `findByChecksum`, `updateStatus`, `saveCheckpoint`, `listByStatus` và unique checksum hoạt động trong SQLite tạm.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/pipeline/job-state-machine.test.ts tests/integration/db/job-repository.test.ts`

Expected: FAIL vì repository và state machine chưa tồn tại.

- [ ] **Step 4: Triển khai giao diện repository**

```ts
export interface JobRepository {
  create(input: NewJob): Promise<Job>;
  findById(id: string): Promise<Job | null>;
  findByChecksum(sha256: string): Promise<Job | null>;
  updateStatus(id: string, status: JobStatus, error?: JobError): Promise<Job>;
  saveCheckpoint(id: string, checkpoint: JobCheckpoint): Promise<void>;
  listByStatus(statuses: JobStatus[]): Promise<Job[]>;
}
```

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/pipeline/job-state-machine.test.ts tests/integration/db/job-repository.test.ts`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/db auto-video-editor/src/pipeline/job-state-machine.ts auto-video-editor/tests
git commit -m "feat: persist editor jobs and state transitions"
```

## Task 4: Inbox watcher và ingest service

**Files:**
- Create: `auto-video-editor/src/infrastructure/filesystem/inbox-watcher.ts`
- Create: `auto-video-editor/src/pipeline/ingest-service.ts`
- Test: `auto-video-editor/tests/unit/filesystem/inbox-watcher.test.ts`
- Test: `auto-video-editor/tests/integration/pipeline/ingest-service.test.ts`

**Interfaces:**
- Consumes: `JobRepository`, `fingerprintFile()`, `AppDirectories`.
- Produces: `InboxWatcher` và `IngestService.ingest(path)`.

- [ ] **Step 1: Viết kiểm thử file chưa ổn định**

Mô phỏng kích thước file thay đổi qua ba lần poll; assert watcher chỉ phát event sau hai lần liên tiếp có cùng size và file mở được.

- [ ] **Step 2: Viết kiểm thử file trùng nội dung**

Đặt hai file khác tên nhưng cùng bytes vào inbox; assert chỉ một job mới được tạo và lần thứ hai trả `duplicateOfJobId`.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/filesystem/inbox-watcher.test.ts tests/integration/pipeline/ingest-service.test.ts`

Expected: FAIL.

- [ ] **Step 4: Triển khai watcher và ingest**

```ts
export interface InboxWatcher {
  start(onStableFile: (path: string) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
}

export class IngestService {
  ingest(path: string): Promise<
    | {kind: 'created'; job: Job}
    | {kind: 'duplicate'; duplicateOfJobId: string}
  >;
}
```

Debounce event, xác minh extension video cho phép, fingerprint trước khi di chuyển, và dùng rename cùng volume hoặc copy+fsync+unlink khác volume.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/filesystem/inbox-watcher.test.ts tests/integration/pipeline/ingest-service.test.ts`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/filesystem/inbox-watcher.ts auto-video-editor/src/pipeline/ingest-service.ts auto-video-editor/tests
git commit -m "feat: ingest stable videos from watched folder"
```

## Task 5: Media inspection và kiểm tra dung lượng

**Files:**
- Create: `auto-video-editor/src/infrastructure/media/media-inspector.ts`
- Create: `auto-video-editor/src/infrastructure/media/silence-detector.ts`
- Create: `auto-video-editor/src/infrastructure/filesystem/disk-space-guard.ts`
- Test: `auto-video-editor/tests/integration/media/media-inspector.test.ts`
- Test: `auto-video-editor/tests/unit/filesystem/disk-space-guard.test.ts`

**Interfaces:**
- Consumes: đường dẫn video từ job.
- Produces: `MediaInspector.inspect(path)`, `SilenceDetector.detect(path)` và `DiskSpaceGuard.assertCapacity()`.

- [ ] **Step 1: Viết kiểm thử media có audio và không có audio**

Với fixture có audio, assert duration/dimensions/FPS/audio đúng; với fixture không audio, assert `hasAudio=false` và không throw.

- [ ] **Step 2: Viết kiểm thử ổ đĩa thiếu chỗ**

Inject provider báo dung lượng còn lại nhỏ hơn `max(10GB, estimatedOutputBytes * 3)`; assert trả lỗi `INSUFFICIENT_DISK_SPACE` và không đổi trạng thái sang bước xử lý tiếp theo.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/media tests/unit/filesystem/disk-space-guard.test.ts`

Expected: FAIL.

- [ ] **Step 4: Triển khai các giao diện**

```ts
export interface MediaInspector {
  inspect(path: string): Promise<MediaMetadata>;
}
export interface SilenceDetector {
  detect(path: string): Promise<SilenceRange[]>;
}
export interface DiskSpaceGuard {
  assertCapacity(input: CapacityRequest): Promise<Result<void, DiskSpaceError>>;
}
```

Mediabunny đọc metadata; FFmpeg thực hiện loudnorm + silencedetect với ngưỡng thích nghi.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/media tests/unit/filesystem/disk-space-guard.test.ts`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/media auto-video-editor/src/infrastructure/filesystem/disk-space-guard.ts auto-video-editor/tests
git commit -m "feat: inspect media and guard local capacity"
```

## Task 6: Transcription engine và cache

**Files:**
- Create: `auto-video-editor/src/infrastructure/transcription/transcription-engine.ts`
- Create: `auto-video-editor/src/infrastructure/transcription/cached-transcription-engine.ts`
- Create: `auto-video-editor/src/infrastructure/transcription/provider.ts`
- Test: `auto-video-editor/tests/unit/transcription/cached-transcription-engine.test.ts`
- Test: `auto-video-editor/tests/integration/transcription/transcription-engine.test.ts`

**Interfaces:**
- Consumes: media path, checksum và `MediaMetadata`.
- Produces: `TranscriptionResult` chứa `Caption[]`, language và warnings.

- [ ] **Step 1: Viết kiểm thử cache hit/miss**

Assert cache miss gọi provider một lần và ghi JSON; cache hit cùng checksum + providerVersion không gọi provider; đổi providerVersion tạo cache miss.

- [ ] **Step 2: Viết kiểm thử video không audio**

Assert engine trả `captions=[]`, warning `NO_AUDIO_TRACK`, không gọi provider và job có thể tiếp tục.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/transcription tests/integration/transcription`

Expected: FAIL.

- [ ] **Step 4: Triển khai adapter và cache**

```ts
export interface TranscriptionProvider {
  readonly version: string;
  transcribe(input: TranscriptionInput): Promise<Caption[]>;
}
export interface TranscriptionEngine {
  transcribe(job: Job, media: MediaMetadata): Promise<TranscriptionResult>;
}
```

Provider cụ thể được inject; không đưa API key vào edit plan hoặc log.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/transcription tests/integration/transcription`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/transcription auto-video-editor/tests
git commit -m "feat: add cached Vietnamese transcription pipeline"
```

## Task 7: Preset, style profile và chỉ mục cảnh trám

**Files:**
- Create: `auto-video-editor/resources/default-presets/expert.json`
- Create: `auto-video-editor/resources/default-presets/viral-education.json`
- Create: `auto-video-editor/resources/default-presets/student-story.json`
- Create: `auto-video-editor/src/infrastructure/assets/asset-indexer.ts`
- Create: `auto-video-editor/src/infrastructure/assets/asset-matcher.ts`
- Test: `auto-video-editor/tests/unit/assets/asset-matcher.test.ts`
- Test: `auto-video-editor/tests/unit/domain/preset.test.ts`

**Interfaces:**
- Consumes: `Preset`, `StyleProfile`, asset metadata và semantic query.
- Produces: versioned default presets, `AssetIndex` và `AssetMatch[]`.

- [ ] **Step 1: Viết kiểm thử ba preset**

Assert cả ba preset hợp schema, preset `expert` là mặc định 1080 × 1920 × 30fps, mỗi preset có version và giới hạn transition/effect.

- [ ] **Step 2: Viết kiểm thử matcher**

Với query `ký túc xá Đài Loan`, assert asset có tags `dormitory`, `taiwan` xếp trên asset chỉ có `campus`; nếu score dưới threshold, trả rỗng để giữ A-roll.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/assets tests/unit/domain/preset.test.ts`

Expected: FAIL.

- [ ] **Step 4: Triển khai chỉ mục và matcher**

```ts
export interface AssetIndexer {
  index(root: string): Promise<AssetIndex>;
}
export interface AssetMatcher {
  match(query: AssetQuery, index: AssetIndex): Promise<AssetMatch[]>;
}
```

MVP dùng metadata, filename, tags và transcript phụ trợ; không tải asset Internet.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/assets tests/unit/domain/preset.test.ts`

Expected: PASS.

```bash
git add auto-video-editor/resources auto-video-editor/src/infrastructure/assets auto-video-editor/tests
git commit -m "feat: add study abroad edit presets and asset matching"
```

## Task 8: Content planner và edit-plan cache

**Files:**
- Create: `auto-video-editor/src/infrastructure/planning/content-planner.ts`
- Create: `auto-video-editor/src/infrastructure/planning/edit-plan-cache.ts`
- Create: `auto-video-editor/src/infrastructure/planning/safety-rules.ts`
- Test: `auto-video-editor/tests/unit/planning/content-planner.test.ts`
- Test: `auto-video-editor/tests/unit/planning/edit-plan-cache.test.ts`

**Interfaces:**
- Consumes: transcript, silence ranges, preset, style profile, asset matcher và metadata.
- Produces: `ContentPlanner.plan(input): Promise<EditPlan>`.

- [ ] **Step 1: Viết kiểm thử cấu trúc edit plan**

Assert planner tạo hook trong 0–3000ms khi transcript có câu phù hợp; segment không chồng lấn sai; B-roll chỉ dùng asset đạt threshold; CTA chỉ lấy từ transcript hoặc brand settings.

- [ ] **Step 2: Viết kiểm thử chống bịa thông tin**

Với transcript không có `100% đỗ visa`, assert edit plan không chứa cụm này; mọi text overlay phải có `source='transcript' | 'brand' | 'user'`.

- [ ] **Step 3: Viết kiểm thử cache**

Assert key là checksum + presetVersion + styleProfileVersion + plannerVersion; thao tác `reduce-effects` sửa plan đã có mà không gọi planner gốc.

- [ ] **Step 4: Triển khai planner và safety rules**

```ts
export interface ContentPlanner {
  readonly version: string;
  plan(input: PlanningInput): Promise<EditPlan>;
  revise(plan: EditPlan, command: RevisionCommand): Promise<EditPlan>;
}
```

Mọi output đi qua `editPlanSchema.parse()` và `assertSourcedClaims()` trước khi ghi cache.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/planning`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/planning auto-video-editor/tests/unit/planning
git commit -m "feat: generate safe cached video edit plans"
```

## Task 9: Remotion composition từ EditPlan

**Files:**
- Create: `auto-video-editor/src/remotion/index.ts`
- Create: `auto-video-editor/src/remotion/Root.tsx`
- Create: `auto-video-editor/src/remotion/AutoEditComposition.tsx`
- Create: `auto-video-editor/src/remotion/scenes/ARollScene.tsx`
- Create: `auto-video-editor/src/remotion/scenes/BRollScene.tsx`
- Create: `auto-video-editor/src/remotion/layers/CaptionLayer.tsx`
- Create: `auto-video-editor/src/remotion/layers/KeywordHighlight.tsx`
- Create: `auto-video-editor/src/remotion/layers/BrandLayer.tsx`
- Create: `auto-video-editor/src/remotion/layers/AudioLayer.tsx`
- Create: `auto-video-editor/src/remotion/transitions/transition-factory.tsx`
- Test: `auto-video-editor/tests/unit/remotion/timeline.test.ts`
- Test: `auto-video-editor/tests/integration/remotion/render-frames.test.ts`

**Interfaces:**
- Consumes: validated `EditPlan`.
- Produces: composition `AutoEdit`, deterministic duration và renderable frames.

- [ ] **Step 1: Viết kiểm thử tính frame**

Assert milliseconds đổi sang frame bằng quy tắc nhất quán; tổng duration trừ overlap transition; không tạo gap ngoài edit plan.

- [ ] **Step 2: Viết kiểm thử render frame đại diện**

Render frame ở hook, A-roll, B-roll, caption và CTA; assert không throw, dimensions 1080 × 1920 và frame không đen hoàn toàn.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/remotion tests/integration/remotion`

Expected: FAIL.

- [ ] **Step 4: Triển khai composition**

Mỗi segment được tạo thành JSX node độc lập. Dùng `TransitionSeries` khi plan có transition; captions nhận `Caption[]`; chuyển động dùng frame interpolation; không dùng CSS animation.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/remotion tests/integration/remotion`

Expected: PASS.

```bash
git add auto-video-editor/src/remotion auto-video-editor/tests
git commit -m "feat: render edit plans with Remotion"
```

## Task 10: Preview, render và quality checker

**Files:**
- Create: `auto-video-editor/src/infrastructure/render/remotion-bundle.ts`
- Create: `auto-video-editor/src/infrastructure/render/preview-service.ts`
- Create: `auto-video-editor/src/infrastructure/render/render-service.ts`
- Create: `auto-video-editor/src/infrastructure/qc/quality-checker.ts`
- Test: `auto-video-editor/tests/integration/render/preview-service.test.ts`
- Test: `auto-video-editor/tests/integration/render/render-service.test.ts`
- Test: `auto-video-editor/tests/unit/qc/quality-checker.test.ts`

**Interfaces:**
- Consumes: `EditPlan`, app directories và disk-space guard.
- Produces: `PreviewArtifact`, `RenderArtifact`, `QualityReport`.

- [ ] **Step 1: Viết kiểm thử preview và render gating**

Assert preview tạo file trong `03_REVIEW`; render từ chối job chưa `awaiting_review` hoặc chưa approved; approved job tạo MP4 trong `04_DONE`.

- [ ] **Step 2: Viết kiểm thử QC**

Assert checker phát hiện missing asset, timeline gap, caption vượt safe area, duration mismatch, unreadable output và disk-space error.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/render tests/unit/qc`

Expected: FAIL.

- [ ] **Step 4: Triển khai services**

```ts
export interface PreviewService {
  create(job: Job, plan: EditPlan): Promise<PreviewArtifact>;
}
export interface RenderService {
  renderApproved(job: Job, plan: EditPlan): Promise<RenderArtifact>;
}
export interface QualityChecker {
  check(input: QualityCheckInput): Promise<QualityReport>;
}
```

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/render tests/unit/qc`

Expected: PASS.

```bash
git add auto-video-editor/src/infrastructure/render auto-video-editor/src/infrastructure/qc auto-video-editor/tests
git commit -m "feat: preview validate and render approved edits"
```

## Task 11: Job runner, checkpoint và recovery

**Files:**
- Create: `auto-video-editor/src/pipeline/job-runner.ts`
- Create: `auto-video-editor/src/pipeline/recovery-service.ts`
- Test: `auto-video-editor/tests/integration/pipeline/job-runner.test.ts`
- Test: `auto-video-editor/tests/integration/pipeline/recovery-service.test.ts`

**Interfaces:**
- Consumes: repository và toàn bộ pipeline services từ Task 4–10.
- Produces: `JobRunner.enqueue(id)`, `JobRunner.start()`, `JobRunner.stop()` và `RecoveryService.recover()`.

- [ ] **Step 1: Viết kiểm thử luồng hoàn chỉnh đến chờ duyệt**

Assert job đi qua đúng trạng thái, tạo transcript/edit plan/preview và dừng ở `awaiting_review`.

- [ ] **Step 2: Viết kiểm thử phục hồi sau restart**

Đặt job ở `planning` với transcript checkpoint đã cache; tạo runner mới; assert không gọi transcription provider và tiếp tục từ planning.

- [ ] **Step 3: Viết kiểm thử lỗi có thể retry**

Giả lập preview lỗi một lần rồi thành công; assert retry có giới hạn, lưu lỗi đầu tiên và kết thúc ở `awaiting_review`.

- [ ] **Step 4: Triển khai runner tuần tự**

```ts
export interface JobRunner {
  start(): Promise<void>;
  stop(): Promise<void>;
  enqueue(jobId: string): Promise<void>;
}
export interface RecoveryService {
  recover(): Promise<RecoveryReport>;
}
```

Concurrency mặc định bằng một; mọi bước ghi checkpoint sau khi artifact đã được ghi nguyên tử.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/pipeline`

Expected: PASS.

```bash
git add auto-video-editor/src/pipeline auto-video-editor/tests/integration/pipeline
git commit -m "feat: orchestrate recoverable video edit jobs"
```

## Task 12: Electron shell, IPC an toàn và dashboard

**Files:**
- Create: `auto-video-editor/src/main/main.ts`
- Create: `auto-video-editor/src/main/bootstrap.ts`
- Create: `auto-video-editor/src/main/ipc.ts`
- Create: `auto-video-editor/src/main/windows.ts`
- Create: `auto-video-editor/src/preload/index.ts`
- Create: `auto-video-editor/src/preload/api.ts`
- Create: `auto-video-editor/src/shared/ipc-contract.ts`
- Create: `auto-video-editor/src/renderer/App.tsx`
- Create: `auto-video-editor/src/renderer/routes.tsx`
- Create: `auto-video-editor/src/renderer/pages/DashboardPage.tsx`
- Create: `auto-video-editor/src/renderer/components/JobTable.tsx`
- Create: `auto-video-editor/src/renderer/components/StatusBadge.tsx`
- Test: `auto-video-editor/tests/unit/shared/ipc-contract.test.ts`
- Test: `auto-video-editor/tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `JobRepository`, `JobRunner`, settings và domain contracts.
- Produces: typed `window.editorApi`, dashboard và Windows autostart bootstrap.

- [ ] **Step 1: Viết kiểm thử IPC contract**

Assert renderer chỉ có các lệnh allowlist: `listJobs`, `getJob`, `approveJob`, `reviseJob`, `cancelJob`, `getSettings`, `saveSettings`, `openFolder`; từ chối path ngoài app root.

- [ ] **Step 2: Viết E2E dashboard thất bại**

Assert dashboard hiển thị năm nhóm trạng thái, nhận job event thời gian thực và không cho `Duyệt & Xuất` với job chưa `awaiting_review`.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/shared/ipc-contract.test.ts && pnpm playwright test tests/e2e/dashboard.spec.ts`

Expected: FAIL.

- [ ] **Step 4: Triển khai shell và dashboard**

Dùng `contextIsolation=true`, `nodeIntegration=false`, typed preload bridge và schema validation cho mọi payload IPC. Bootstrap tạo directories, migrations, recovery, watcher và runner trước khi phát trạng thái ready.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/shared/ipc-contract.test.ts && pnpm playwright test tests/e2e/dashboard.spec.ts`

Expected: PASS.

```bash
git add auto-video-editor/src/main auto-video-editor/src/preload auto-video-editor/src/shared auto-video-editor/src/renderer auto-video-editor/tests
git commit -m "feat: add secure Windows editor dashboard"
```

## Task 13: Review Player, revision commands và approval

**Files:**
- Create: `auto-video-editor/src/renderer/pages/ReviewPage.tsx`
- Create: `auto-video-editor/src/renderer/components/PreviewPlayer.tsx`
- Modify: `auto-video-editor/src/main/ipc.ts`
- Modify: `auto-video-editor/src/pipeline/job-runner.ts`
- Test: `auto-video-editor/tests/e2e/review.spec.ts`
- Test: `auto-video-editor/tests/integration/pipeline/revision-flow.test.ts`

**Interfaces:**
- Consumes: preview artifact, planner `revise()`, render service và typed IPC.
- Produces: review UI và commands `approve`, `reduce-effects`, `increase-pace`, `change-music`, `custom-note`.

- [ ] **Step 1: Viết E2E màn hình review**

Assert video phát được; transcript hiển thị; các cảnh báo hiện rõ; bấm `Giảm hiệu ứng` tạo revision; bấm `Duyệt & Xuất` đưa job sang `rendering`.

- [ ] **Step 2: Viết kiểm thử revision không transcription lại**

Assert revision dùng edit plan đã cache, không gọi transcription provider, tăng `planRevision` và giữ checksum nguồn.

- [ ] **Step 3: Chạy kiểm thử để xác nhận thất bại**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/pipeline/revision-flow.test.ts && pnpm playwright test tests/e2e/review.spec.ts`

Expected: FAIL.

- [ ] **Step 4: Triển khai review flow**

Custom note giới hạn 500 ký tự; revision được validate và lưu thành phiên bản mới; approve ghi timestamp trước khi enqueue render.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/integration/pipeline/revision-flow.test.ts && pnpm playwright test tests/e2e/review.spec.ts`

Expected: PASS.

```bash
git add auto-video-editor/src auto-video-editor/tests
git commit -m "feat: review revise and approve video edits"
```

## Task 14: Settings, secrets, privacy warnings và notifications

**Files:**
- Create: `auto-video-editor/src/renderer/pages/SettingsPage.tsx`
- Create: `auto-video-editor/src/infrastructure/security/secret-store.ts`
- Create: `auto-video-editor/src/infrastructure/notifications/windows-notifier.ts`
- Create: `auto-video-editor/src/infrastructure/qc/privacy-detector.ts`
- Modify: `auto-video-editor/src/main/ipc.ts`
- Test: `auto-video-editor/tests/unit/security/secret-store.test.ts`
- Test: `auto-video-editor/tests/unit/qc/privacy-detector.test.ts`
- Test: `auto-video-editor/tests/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: `AppSettings`, brand files, Windows credential storage.
- Produces: persisted non-secret settings, encrypted secret references, privacy warnings và Windows notifications.

- [ ] **Step 1: Viết kiểm thử secret không xuất hiện trong file/log**

Assert lưu API key chỉ ghi secret reference; serialized settings và captured logs không chứa plaintext key.

- [ ] **Step 2: Viết kiểm thử privacy detector**

Với OCR/text fixture chứa số hộ chiếu, ngày sinh, số điện thoại và mã hồ sơ, assert tạo warning có loại và vùng thời gian; không tự xóa nội dung.

- [ ] **Step 3: Viết E2E settings**

Assert lưu logo, font, màu, CTA, Zalo, preset mặc định, autostart và notification; font không hỗ trợ tiếng Việt bị từ chối với thông báo rõ.

- [ ] **Step 4: Triển khai settings và adapters**

```ts
export interface SecretStore {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}
```

Không ghi nội dung giấy tờ đầy đủ vào log; notification chỉ chứa tên job và trạng thái.

- [ ] **Step 5: Chạy test và commit**

Run: `cd auto-video-editor && pnpm vitest run tests/unit/security tests/unit/qc/privacy-detector.test.ts && pnpm playwright test tests/e2e/settings.spec.ts`

Expected: PASS.

```bash
git add auto-video-editor/src auto-video-editor/tests
git commit -m "feat: secure editor settings and privacy warnings"
```

## Task 15: Windows packaging và kiểm thử nghiệm thu

**Files:**
- Modify: `auto-video-editor/package.json`
- Create: `auto-video-editor/electron-builder.yml`
- Create: `auto-video-editor/scripts/verify-windows-package.mjs`
- Create: `auto-video-editor/tests/e2e/acceptance.spec.ts`
- Create: `auto-video-editor/README.md`

**Interfaces:**
- Consumes: ứng dụng hoàn chỉnh từ Task 1–14.
- Produces: Windows installer, smoke-test report và hướng dẫn sử dụng.

- [ ] **Step 1: Viết kiểm thử nghiệm thu end-to-end**

Fixture batch gồm video hợp lệ, video không audio, file trùng và file lỗi. Assert: job hợp lệ đến `awaiting_review`; video không audio có warning; file trùng không tạo job mới; file lỗi đến `ERROR`; approve tạo MP4 đọc được.

- [ ] **Step 2: Viết package verifier**

Script kiểm tra installer tồn tại, unpacked app có Remotion bundle/FFmpeg/resources, app khởi động được và migrations chạy trong thư mục dữ liệu tạm.

- [ ] **Step 3: Chạy toàn bộ kiểm thử**

Run: `cd auto-video-editor && pnpm lint && pnpm typecheck && pnpm vitest run && pnpm playwright test`

Expected: tất cả PASS.

- [ ] **Step 4: Build và kiểm tra gói Windows**

Run: `cd auto-video-editor && pnpm build && pnpm package:win && node scripts/verify-windows-package.mjs`

Expected: installer và unpacked build được xác minh; không thiếu binary/tài nguyên.

- [ ] **Step 5: Chạy thử batch 10 video và ghi kết quả**

Chạy trên máy Windows mục tiêu với 10 video đại diện. Ghi thời gian transcription, preview, render, peak disk/RAM, lỗi và kết quả phục hồi sau một lần restart có chủ đích.

- [ ] **Step 6: Commit**

```bash
git add auto-video-editor
git commit -m "build: package and verify Windows editor MVP"
```

## Final Verification Gate

- [ ] Đối chiếu 12 tiêu chí nghiệm thu trong spec với kết quả test hoặc báo cáo chạy Windows.
- [ ] Chạy `git status --short` và xác nhận không có file ngoài ý muốn.
- [ ] Chạy lại `pnpm lint`, `pnpm typecheck`, `pnpm vitest run`, `pnpm playwright test` sau thay đổi cuối.
- [ ] Kiểm tra installer trên một Windows user profile sạch.
- [ ] Kiểm tra restart giữa job không gọi lại transcription đã cache.
- [ ] Kiểm tra API key không xuất hiện trong database, settings, logs hoặc crash report.
- [ ] Kiểm tra preview và MP4 cuối cùng dùng cùng `EditPlan` revision đã duyệt.
- [ ] Tạo ghi chú phát hành MVP với giới hạn đã biết và cấu hình máy đã kiểm thử.
