import assert from "node:assert/strict";

// Local integration check only. The built Worker receives synthetic dispatcher
// headers here; this does NOT verify the hosted Sites trust boundary.
const runtime = "http://127.0.0.1:8787";
const development = "http://127.0.0.1:5173";
const ownerA = `storage-check-a-${crypto.randomUUID()}`;
const ownerB = `storage-check-b-${crypto.randomUUID()}`;
const ids = new Set();
const input = { topic: "Demo storage check", audience: "Workshop founders", channel: "LinkedIn", tone: "Practical", keyPoints: "A fictional test brief.", callToAction: "", body: "Demo output — durable storage verification.", status: "draft" };

async function request(base, path, { owner, method = "GET", data, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(owner ? { "oai-authenticated-user-id": owner, "oai-authenticated-user-email": "fixture@sites.test" } : {}), ...headers, ...(data ? { "Content-Type": "application/json" } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  return { status: response.status, result };
}

try {
  for (const method of ["GET", "POST"]) {
    assert.equal((await request(runtime, "/api/drafts", { method, data: method === "POST" ? input : undefined })).status, 401);
  }
  assert.equal((await request(runtime, "/api/drafts", { headers: { Cookie: "__sites_local_auth=1" } })).status, 401);
  console.log("PASS: production build rejects missing identity and the development auth cookie");

  assert.equal((await request(development, "/api/drafts", { owner: ownerA })).status, 401);
  const local = await request(development, "/api/drafts", { headers: { Cookie: "__sites_local_auth=1" } });
  assert.equal(local.status, 200);
  console.log("PASS: development strips spoofed identity headers and supports its documented local identity");

  assert.equal((await request(runtime, "/api/drafts", { owner: ownerA, method: "POST", data: { ...input, owner_id: ownerB } })).status, 400);
  for (const change of [{ topic: " " }, { topic: "a".repeat(301) }, { audience: "" }, { keyPoints: "a".repeat(2001) }, { body: " " }, { status: "published" }, { channel: "Other" }]) {
    assert.equal((await request(runtime, "/api/drafts", { owner: ownerA, method: "POST", data: { ...input, ...change } })).status, 400);
  }
  assert.equal((await request(runtime, "/api/drafts", { owner: ownerA, method: "POST", data: input, headers: { Origin: "https://unrelated.invalid" } })).status, 403);
  console.log("PASS: owner injection, invalid fields, and cross-origin writes rejected");

  const requestId = crypto.randomUUID();
  const created = await request(runtime, "/api/drafts", { owner: ownerA, method: "POST", data: input, headers: { "X-Draft-Request-Id": requestId } });
  assert.equal(created.status, 201);
  const saved = created.result.draft;
  ids.add(saved.id);
  assert.equal(saved.body, input.body);
  assert.equal("owner_id" in saved, false);
  const retry = await request(runtime, "/api/drafts", { owner: ownerA, method: "POST", data: input, headers: { "X-Draft-Request-Id": requestId } });
  assert.equal(retry.status, 200);
  assert.equal(retry.result.draft.id, saved.id);
  assert.equal((await request(runtime, "/api/drafts", { owner: ownerB })).result.drafts.some((entry) => entry.id === saved.id), false);
  for (const owner of [undefined, ownerB]) {
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await request(runtime, `/api/drafts/${saved.id}`, { owner, method, data: method === "PUT" ? input : undefined, headers: { "If-Match": saved.updatedAt } });
      assert.equal(response.status, owner ? 404 : 401);
    }
  }
  console.log("PASS: create retries are idempotent; list/read/update/delete enforce owner isolation");

  const changed = { ...input, body: "Demo output — edited and reviewed.", status: "reviewed" };
  const updated = await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA, method: "PUT", data: changed, headers: { "If-Match": saved.updatedAt } });
  assert.equal(updated.status, 200);
  const reopened = await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA });
  assert.equal(reopened.result.draft.body, changed.body);
  assert.equal(reopened.result.draft.status, "reviewed");
  assert.equal((await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA, method: "PUT", data: input, headers: { "If-Match": saved.updatedAt } })).status, 409);
  assert.equal((await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA, method: "DELETE", headers: { "If-Match": saved.updatedAt } })).status, 409);
  const deleted = await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA, method: "DELETE", headers: { "If-Match": updated.result.draft.updatedAt } });
  assert.equal(deleted.status, 200);
  assert.equal((await request(runtime, `/api/drafts/${saved.id}`, { owner: ownerA })).status, 404);
  ids.delete(saved.id);
  console.log("PASS: save/reopen preserves body and reviewed status; stale updates/deletes fail; owned deletion succeeds");
} finally {
  // Remove only this run's newly created synthetic records, never user drafts.
  for (const id of ids) {
    const current = await request(runtime, `/api/drafts/${id}`, { owner: ownerA });
    if (current.status === 200) await request(runtime, `/api/drafts/${id}`, { owner: ownerA, method: "DELETE", headers: { "If-Match": current.result.draft.updatedAt } });
  }
}
