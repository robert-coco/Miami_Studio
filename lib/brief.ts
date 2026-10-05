import { z } from "zod";

export const briefSchema = z.object({
  topic: z.string().trim().min(1, "Add a topic for your draft.").max(300, "Keep your topic to 300 characters or fewer."),
  audience: z.string().trim().min(1, "Tell us who you’re writing for."),
  channel: z.enum(["LinkedIn", "X"]),
  tone: z.enum(["Practical", "Warm", "Bold"]),
  keyPoints: z.string().trim().min(1, "Add at least one key point.").max(2000, "Keep your key points to 2,000 characters or fewer."),
  callToAction: z.string().trim(),
});

export type Brief = z.infer<typeof briefSchema>;
export type BriefErrors = Partial<Record<keyof Brief, string>>;

export function validateBrief(brief: Brief): BriefErrors {
  const result = briefSchema.safeParse(brief);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
}

export const sampleBrief: Brief = {
  topic: "Small steps make better launches",
  audience: "First-time founders building their first product",
  channel: "LinkedIn",
  tone: "Practical",
  keyPoints: "Start with one customer problem.\nTest a small version before building more.\nUse feedback to decide what comes next.",
  callToAction: "What’s one small thing you could test this week?",
};
