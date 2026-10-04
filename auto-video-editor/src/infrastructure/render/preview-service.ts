import { join } from "node:path";
import type { Job } from "../../domain/job";
import type { EditPlan } from "../../domain/edit-plan";
import type { AppDirectories } from "../filesystem/app-directories";
import type { RemotionRenderer } from "./remotion-bundle";
export class PreviewService {
  constructor(
    private dirs: AppDirectories,
    private renderer: RemotionRenderer,
    private guard: (estimate?: number) => Promise<void>,
  ) {}
  async create(job: Job, plan: EditPlan) {
    await this.guard(plan.durationMs * 2500);
    const path = join(this.dirs.review, `${job.id}-r${plan.revision}.mp4`);
    await this.renderer.render(plan, path, true);
    return { path, revision: plan.revision };
  }
}
