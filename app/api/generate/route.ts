import { briefSchema } from "@/lib/brief";

// Demo templates only. No model requests, credentials, or record storage.
export async function POST(request: Request) {
  let input: unknown;
  try {
    const body = await request.text();
    if (body.length > 20000) return Response.json({ error: "This brief is too long. Shorten it and try again." }, { status: 413 });
    input = JSON.parse(body);
  } catch {
    return Response.json({ error: "We couldn’t read that brief. Please try again." }, { status: 400 });
  }
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) return Response.json({ error: "Check the highlighted fields.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const brief = parsed.data;
  const opening = { Practical: "A simple place to start:", Warm: "A little reminder for the journey:", Bold: "Start small. Make it count." }[brief.tone];
  const content = brief.channel === "X"
    ? `${brief.topic}\n\n${brief.keyPoints.split("\n")[0]}${brief.callToAction ? `\n\n${brief.callToAction}` : ""}`
    : `${brief.topic}\n\n${opening}\n\nFor ${brief.audience}:\n\n${brief.keyPoints}${brief.callToAction ? `\n\n${brief.callToAction}` : ""}`;
  return Response.json({ mode: "demo", content }, { headers: { "Cache-Control": "no-store" } });
}
