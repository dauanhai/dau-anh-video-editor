import type { Caption } from "../../domain/edit-plan";
export interface TranscriptionProvider {
  readonly version: string;
  transcribe(input: { file: string }): Promise<Caption[]>;
}
