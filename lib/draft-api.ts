import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { draftInputSchema } from "./drafts";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function withOwner(request: Request, action: (ownerId: string) => Promise<Response>) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: "Sign in to access your saved drafts.", signInUrl: chatGPTSignInPath("/") }, 401);
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("origin");
      if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
        throw new ApiError(403, "This request must come from Content Studio.");
      }
    }
    return await action(user.userId);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status);
    // Do not log request bodies, identity, or underlying binding details.
    console.error("Draft storage operation failed");
    return json({ error: "Draft storage is unavailable. Your unsaved text is still here. Try again shortly." }, 503);
  }
}

export async function readDraftInput(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Send a JSON draft.");
  const text = await request.text();
  if (text.length > 50000) throw new ApiError(413, "This draft is too large. Shorten it before saving.");
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new ApiError(400, "The draft could not be read."); }
  const result = draftInputSchema.safeParse(data);
  if (!result.success) throw new ApiError(400, "Check the brief, draft text, and status before saving. Extra fields are not accepted.");
  return result.data;
}

export function expectedVersion(request: Request) {
  const version = request.headers.get("if-match");
  if (!version) throw new ApiError(428, "Reopen the saved draft before changing it.");
  return version;
}
