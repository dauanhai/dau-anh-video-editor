import { createHash } from "node:crypto";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { atomicJson } from "../filesystem/atomic-file";
import { editPlanSchema, type EditPlan } from "../../domain/edit-plan";
export class EditPlanCache {
  constructor(private root: string) {}
  key(
    checksum: string,
    presetVersion: number,
    styleProfileVersion: number,
    plannerVersion: string,
  ) {
    return createHash("sha256")
      .update(
        JSON.stringify([
          checksum,
          presetVersion,
          styleProfileVersion,
          plannerVersion,
        ]),
      )
      .digest("hex");
  }
  async get(key: string) {
    try {
      return editPlanSchema.parse(
        JSON.parse(await readFile(join(this.root, key + ".json"), "utf8")),
      );
    } catch {
      return null;
    }
  }
  async put(key: string, plan: EditPlan) {
    await atomicJson(
      join(this.root, key + ".json"),
      editPlanSchema.parse(plan),
    );
  }
}
