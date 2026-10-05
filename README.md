# Content Studio — Miami AI School

Content Studio now includes a validated brief, editable **Demo output**, and an
owner-scoped D1 draft library with save, reopen, reviewed status, and confirmed
delete. Generation uses a server-side template, not a live model.
See [the product brief](docs/project-brief.md) and [storage verification](docs/storage-verification.md).

## Local development

Requires Node.js >=22.13.0 and npm. This project was initialized with the
ChatGPT Sites 0.1.75 Vinext starter, using its documented portable runtime.
The starter's locked dependencies and Sites build plugin are preserved.

Run commands from this directory:

| Purpose | Actual command | Implementation |
| --- | --- | --- |
| Locked install | `npm run install:ci` | `node scripts/install-ci.mjs` |
| Development | `npm run dev` | `node scripts/run-framework.mjs dev` (Vinext on portable) |
| Production build | `npm run build` | `node scripts/run-framework.mjs build` |
| Typecheck | `npm run typecheck` | `tsc --noEmit` (added for this project) |
| Built Worker preview | `npm run start` | Wrangler local dev against `dist/server/wrangler.json` |
| Database migration generation | `npm run db:generate` | `drizzle-kit generate` |
| Lint (optional) | `npm run lint` | Starter ESLint script |
| Storage integration check | `node scripts/checks/draft-storage.mjs` | Requires migrated local D1, `npm run dev` on 5173, and `npm run start` on 8787; creates and removes only synthetic test records |
| General test command | Pending | No `npm test` script or general unit/browser suite |

Development starts on loopback port 5173; use the exact URL printed by Vinext.
Stop it with Ctrl+C. The production build emits the Sites-compatible Worker and
assets under `dist/`. `npm run start` runs the built artifact locally and does
not publish it. Validate this stage with the typecheck, production build, and
the storage integration check and the manual browser workflow below.

## Sites, storage, and credentials

This stage is local and unpublished. No hosted Site is registered, no project ID
is assigned, and no source has been pushed. Hosted access controls do not apply
to localhost; the preview binds only to loopback.

The logical D1 binding `DB` stores drafts in an owner-scoped `drafts` table.
The initial migration has been applied locally; do not replay it on that database. Local D1 runs through the starter's Worker simulation. Future
hosting and production D1 provisioning will use Sites with restricted access.
No separate Cloudflare hosting account or social-network account is needed.

No API key is required for demo generation. Future live model calls will use a
server-only secret; never place credentials in client code or Git. Dependencies,
build output, local Worker state, environment files, and private key files are
excluded by `.gitignore`. Only empty examples may be explicitly tracked.

## Draft storage and local sign-in

Use **Sign in with ChatGPT** in the library on the local development preview.
The bundled `sites()` Vite plugin handles `/signin-with-chatgpt` on loopback,
sets its HTTP-only local cookie, strips caller-supplied identity headers, and
injects the documented local test identity. This is a development-server feature,
not an application auth bypass. It is absent from the production Worker.
`npm run start` does not provide local sign-in.

All draft APIs use `getChatGPTUser()` and its stable `userId`. Never accept an
`owner_id` from browser JSON. The Sites dispatcher must supply authenticated
headers in a hosted runtime. That hosted trust boundary has **not been verified**;
no hosted migration, registration, or publishing has occurred.

- `GET /api/drafts`: current owner's saved library.
- `POST /api/drafts`: create, with a stable `X-Draft-Request-Id` UUID for safe retries.
- `GET /api/drafts/:id`: reopen one owned draft.
- `PUT /api/drafts/:id`: update; requires `If-Match` with its last `updatedAt`.
- `DELETE /api/drafts/:id`: delete after UI confirmation; requires the same version check.

Writes return success only after D1 confirms them. Failures keep workspace text.
Unsaved drafts stay in their tabs while the page is open; leaving prompts when
unsaved text exists. D1, not browser storage, is the durable source of truth.

### Migration on a fresh local database

Build first. Apply this **only if the table is not already present**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_chunky_onslaught.sql
```

The SQL and Drizzle metadata are now immutable migration history. Subsequent
schema changes need a new generated migration. Hosted application remains a
separate, explicitly approved release step.

### Manual browser demonstration

1. Open the development preview and sign in using its library link.
2. Generate a demo, edit its text, choose Draft or Reviewed, and select Save draft.
3. Wait for server-confirmed success, refresh, and reopen its title from Saved library.
4. Edit and save again. Confirm the edited text remains after another refresh.
5. Select Delete to inspect confirmation; Keep draft cancels without deleting.
6. Check narrow-screen layout at 390px and verify failed saves leave edits visible.

A fictional reviewed record titled **Workshop demo: small steps make better launches**
is retained in local D1 for this demonstration. Browser automation was blocked by
browser policy in the storage session, so the UI demonstration is still pending.

## Original starter reference

The documented runtime and storage instructions below are retained from the starter.

### vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
