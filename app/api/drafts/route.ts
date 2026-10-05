import { createDraft, listDrafts, readDraft } from "@/db/drafts";
import { ApiError, json, readDraftInput, withOwner } from "@/lib/draft-api";
import type { StoredDraft } from "@/lib/drafts";

export function GET(request: Request) {
  return withOwner(request, async (ownerId) => json({ drafts: await listDrafts(ownerId) }));
}

export function POST(request: Request) {
  return withOwner(request, async (ownerId) => {
    const data = await readDraftInput(request);
    const requestId = request.headers.get("x-draft-request-id") || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new ApiError(400, "Invalid save request.");
    const draft = await createDraft(ownerId, data, requestId);
    if (!draft) {
      const existing = await readDraft(ownerId, requestId);
      if (existing && Object.entries(data).every(([key, value]) => existing[key as keyof StoredDraft] === value)) return json({ draft: existing });
      throw new ApiError(409, "An earlier save may have completed. Reopen it from the library to compare; your edits remain here.");
    }
    return json({ draft }, 201);
  });
}
