import { deleteDraft, readDraft, updateDraft } from "@/db/drafts";
import { ApiError, expectedVersion, json, readDraftInput, withOwner } from "@/lib/draft-api";

type Context = { params: Promise<{ id: string }> };

async function owned(ownerId: string, context: Context) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, "Draft not found.");
  const draft = await readDraft(ownerId, id);
  if (!draft) throw new ApiError(404, "Draft not found.");
  return draft;
}

export function GET(request: Request, context: Context) {
  return withOwner(request, async (ownerId) => json({ draft: await owned(ownerId, context) }));
}

export function PUT(request: Request, context: Context) {
  return withOwner(request, async (ownerId) => {
    const current = await owned(ownerId, context);
    const draft = await updateDraft(ownerId, current.id, expectedVersion(request), await readDraftInput(request));
    if (!draft) throw new ApiError(409, "This draft changed elsewhere. Your edits are safe; reopen the saved version in a separate tab to compare.");
    return json({ draft });
  });
}

export function DELETE(request: Request, context: Context) {
  return withOwner(request, async (ownerId) => {
    const current = await owned(ownerId, context);
    const deleted = await deleteDraft(ownerId, current.id, expectedVersion(request));
    if (!deleted) throw new ApiError(409, "This draft changed elsewhere. Reload the library and review it before deleting.");
    return json({ deleted: true });
  });
}
