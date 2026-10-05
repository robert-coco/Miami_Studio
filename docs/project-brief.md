# Miami AI School — Content Studio

Status: Local demo studio and owner-scoped D1 storage implemented. API checks passed; hosted identity verification and browser workflow inspection remain pending. See `storage-verification.md`.

## Confirmed workshop decisions

- Generate one strong draft per request.
- X supports a single post, not a thread.
- Saved records belong to the private founder through Sites identity.
- Use explicit Save, with a prefilled fictional brief on first load.
- Default to clearly labeled sample generation; live generation is optional.
- Current milestone: demo generation and durable owner-scoped drafts. Live model generation and hosting remain separate.

## Product goal

Build a focused Content Studio for a founder who wants to turn a clear brief into an editable LinkedIn or X draft, save it durably, and reopen it later. The first release uses sample content, never posts to a social network, and remains private and unpublished.

## Primary workflow

1. Choose LinkedIn or X and complete a concise content brief.
2. Generate a draft through a server endpoint.
3. Edit the generated text in the studio.
4. Save the brief and draft to Sites D1.
5. Browse saved drafts and reopen one for further editing.

## Screen structure

Use one responsive working surface rather than a marketing landing page.

- **Header:** Miami AI School Content Studio, current save state, and New draft action.
- **Brief panel:** topic (required, max 300), audience (required), channel (LinkedIn or X), tone (Practical, Warm, Bold), key points (required, max 2,000), and optional call to action.
- **Editor panel:** generated draft, Generate/Regenerate action, editable content, platform-aware character count, Save action, and clear loading/error/saved states.
- **Saved drafts panel:** compact list ordered by most recently updated, with title, platform, status, and updated time. Selecting an item reopens it in the brief and editor panels.
- **Responsive behavior:** desktop uses a two-column studio with saved drafts alongside; mobile presents the same areas as stacked sections or tabs without losing editing state.

## Durable data fields

Use one `drafts` table for the first release:

- `id`: UUID primary key
- `owner_id`: stable ChatGPT user ID, supplied by server identity
- `topic`, `audience`, `channel`, `tone`: brief fields
- `key_points`, `call_to_action`: brief text and optional action (empty string when omitted)
- `body`: editable draft text
- `status`: `draft` or `reviewed`
- `created_at`, `updated_at`: server-generated UTC timestamps

All generation in this milestone is visibly labeled Demo output; no live-model provenance is claimed.

Add an index on `(owner_id, updated_at)` because the saved-drafts query filters by owner and orders by recency. D1 is authoritative; browser storage is not used for saved records.

## Server boundaries

- `POST /api/generate`: validates the brief and returns explicitly labeled template Demo output. Future model calls must remain server-only.
- `GET /api/drafts`: returns the signed-in user's saved drafts ordered by `updated_at` descending.
- `POST /api/drafts`: validates and creates a saved draft.
- `GET /api/drafts/:id`: returns one owned draft.
- `PUT /api/drafts/:id`: validates and updates one owned draft, checking its last saved version.
- `DELETE /api/drafts/:id`: deletes one owned draft after UI confirmation and a version check.

All D1 queries use prepared statements through a small database helper and include `owner_id` in reads and writes.

## Sites-compatible implementation

- Use the installed Vinext starter with React 19 and TypeScript.
- Keep the starter's `sites()` Vite integration and Cloudflare Worker output.
- Declare the logical D1 binding as `DB` in `.openai/hosting.json` and keep R2 unset.
- Define the schema in `db/schema.ts`, generate Drizzle migrations, and commit the generated SQL and metadata.
- Use the bundled Sites/ChatGPT identity helpers; do not add a separate authentication provider.
- Use a private local workflow for this session. Do not create or publish a Site yet.

## Installed starter commands

These commands come from the installed starter's `package.json`:

- Setup copy: `node /Users/robpz24/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/scripts/project-setup.mjs`
- Dependency installation: `node /Users/robpz24/.codex/plugins/cache/openai-curated-remote/sites/0.1.75/scripts/install-dependencies.mjs`
- Development preview: `npm run dev`
- Production build: `npm run build`
- Built Worker preview with local D1: `npm run start`
- Migration generation: `npm run db:generate`

## Build stages and checks

### Stage 1 — Starter and project configuration

After approval, copy the installed Vinext starter into the empty checkout and install its locked dependencies. Configure the portable execution profile and declare `DB`.

Checks:

- `npm pkg get scripts` shows the installed starter scripts listed above.
- `npm run build` completes and emits `dist/server/index.js` plus `dist/server/wrangler.json`.
- Inspect the Worker entry to confirm the built output exports a callable default `fetch` handler.

### Stage 2 — D1 schema and data access

Add the `drafts` schema, database helper, ownership rules, and sample records used only in development/demo flows.

Checks:

- `npm run db:generate` creates a new migration.
- Inspect every generated `drizzle/*.sql` file for complete, D1-safe schema statements.
- Apply the pending local migration with:

  `node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/<generated-migration>.sql`

- Query the local database to confirm the table and `idx_drafts_owner_updated` index exist.

### Stage 3 — Server endpoints

Implement validation, owner-scoped CRUD, and the server-only model boundary.

Checks:

- With the local signed-in test user, create, list, read, and update a draft through the endpoints.
- Confirm another owner ID cannot read or update the record.
- Confirm invalid platform, empty content, and oversized fields return clear 4xx responses.
- Confirm missing model credentials produce a controlled server error without exposing configuration details.

### Stage 4 — Studio interface

Build the brief form, editable draft area, save states, saved-draft browser, and responsive layout using the starter's included UI primitives.

Checks:

- `npm run dev` serves the first meaningful Content Studio view successfully.
- Generate, edit, save, refresh, and reopen a sample draft in the browser.
- Verify LinkedIn/X switching, X character count, loading, empty, error, and saved states.
- Verify keyboard navigation, visible labels, focus states, and layouts at mobile and desktop widths.

### Stage 5 — Sites packaging readiness

Build and run the final local Worker without publishing it.

Checks:

- `npm run build` succeeds after all schema and source changes.
- `npm run start` serves the built Worker against the persisted local D1 state.
- Repeat the save-refresh-reopen flow against the built Worker.
- Confirm `.openai/hosting.json` declares `DB`, R2 remains unset, credentials are absent from tracked files, and `git status` contains only intended source/configuration changes.

## Account and credential dependencies

- **Sites access:** already available in this account. No Site will be created or published during this planning session.
- **ChatGPT identity:** supplied by Sites for private visitors; no separate auth account or provider is required. Local portable preview uses the starter's built-in test identity.
- **Model access:** sample mode and this placeholder require no API key. Optional live generation requires an OpenAI API key with API billing/access. Store it locally in an untracked environment file and later as a Sites runtime secret such as `OPENAI_API_KEY`; never commit or display it.
- **Model choice:** select a model ID available to the account at implementation time and expose it to the server through an optional runtime value such as `OPENAI_MODEL`.
- **No social credentials:** LinkedIn and X credentials are neither needed nor requested because the app will not post content.

## Acceptance criteria

- A founder can complete a brief for LinkedIn or X and receive a server-generated draft when model credentials are configured.
- The draft remains fully editable before and after saving.
- Saved records survive refreshes in D1 and can be reopened later.
- Records are scoped to the signed-in Sites user.
- The app includes only sample content and has no social publishing capability.
- The project builds as a Sites-compatible Worker and is not published until explicitly requested.
