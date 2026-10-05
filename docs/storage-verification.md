# Draft storage verification

## Implemented

- Sites D1 `DB`, Drizzle-owned schema and migration `0000_chunky_onslaught.sql`.
- All 12 requested fields; status, tone, and channel constraints; owner/update index.
- Parameterized server queries scope all record operations to `getChatGPTUser().userId`.
- Browser ownership fields are rejected. Responses omit owner identity and use no-store caching.
- Server validation, cross-origin write rejection, version checks, and idempotent create retries.
- Save, library, reopen, editing, reviewed status, and a native delete confirmation dialog.
- Failed requests do not remove workspace drafts; confirmed deletion leaves open text unsaved.
- No model credentials, live AI, social posting, or browser-backed durable storage.

## Checks completed locally

- `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Inspected migration, verified absent table, applied migration to local D1 only.
- Verified the table and index exist; query planner uses `idx_drafts_owner_updated`.
- `node scripts/checks/draft-storage.mjs` passed against development and built Worker runtimes.
- Anonymous create/list/read/update/delete return 401.
- Second synthetic owner cannot list the first owner's draft; read/update/delete return 404.
- Invalid fields, injected `owner_id`, invalid statuses, and cross-origin writes are rejected.
- Owned save/update/reopen preserves text and reviewed status; stale update/delete returns 409.
- Repeated create request does not duplicate the record. Owned deletion succeeds.
- Built production Worker rejects the local auth cookie; development strips spoofed auth headers.
- Production JS contains neither the local identity constant nor local auth cookie name.
- Saved one fictional reviewed draft through the documented development sign-in flow, stopped
  both servers, restarted development, then listed/reopened it with identical text using fresh
  HTTP requests. The sample remains in local D1 for manual inspection.

## Pending verification and release boundary

Browser automation rejected the localhost preview under its browser URL policy.
No workaround was attempted. Browser save/refresh/reopen, confirmation/cancel,
failure preservation, and desktop/390px inspection of the finished storage UI
remain pending. Follow the manual demonstration in README.

**No deployed-runtime authentication claim:** synthetic headers used against the local
production Worker simulate Sites dispatch; they do not validate hosted header sanitization.
No Site has been registered, published, or migrated remotely in this session.

At the separately approved release stage:

1. Apply hosted migration through the Sites release workflow, keeping default restricted access.
2. Sign in through actual Sites dispatch; verify stable user identity from `getChatGPTUser()`.
3. Verify missing identity and forged incoming authenticated-user headers cannot gain access.
4. Use two actual permitted users to repeat create/list/read/update/delete ownership checks.
5. Verify the development cookie cannot authenticate in the deployed runtime.
6. Save, refresh, reopen, update, and confirm deletion of explicitly disposable demo records.

Do not expose identity headers or credentials in screenshots, logs, or reports.
