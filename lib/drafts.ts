import { z } from "zod";
import { briefSchema } from "./brief";

export const draftInputSchema = briefSchema.extend({
  body: z.string().min(1, "Write something before saving.").max(20000, "Keep the draft below 20,000 characters.").refine((value) => value.trim().length > 0, "Write something before saving."),
  status: z.enum(["draft", "reviewed"]),
}).strict();

export type DraftInput = z.infer<typeof draftInputSchema>;
export type StoredDraft = DraftInput & { id: string; createdAt: string; updatedAt: string };
export type DraftSummary = Pick<StoredDraft, "id" | "topic" | "channel" | "status" | "updatedAt">;
