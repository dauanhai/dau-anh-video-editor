import { join } from "node:path";
import type { Job } from "../../domain/job";
import type { EditPlan } from "../../domain/edit-plan";
import type { AppDirectories } from "../filesystem/app-directories";
import type { RemotionRenderer } from "./remotion-bundle";
export class RenderService {
  constructor(
    private dirs: AppDirectories,
    private guard: (estimate?: number) => Promise<void>,
    private renderer?: RemotionRenderer,
  ) {}
  async renderApproved(job: Job, plan: EditPlan) {
    if (
      !["awaiting_review", "rendering"].includes(job.status) ||
      job.approvedRevision !== plan.revision ||
      job.checkpoint.previewRevision !== plan.revision
    )
      throw new Error("APPROVAL_REQUIRED");
    await this.guard(plan.durationMs * 2500);
    if (!this.renderer) throw new Error("RENDERER_NOT_CONFIGURED");
    const path = join(this.dirs.done, `${job.id}-r${plan.revision}.mp4`);
    await this.renderer.render(plan, path, false);
    return { path, revision: plan.revision };
  }
}
