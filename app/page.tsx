"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, FileText, LoaderCircle, PenLine, Sparkles } from "lucide-react";
import { draftInputSchema, type DraftInput, type DraftSummary, type StoredDraft } from "@/lib/drafts";
import { sampleBrief, validateBrief, type Brief, type BriefErrors } from "@/lib/brief";

type Draft = { id: number; requestId: string; content: string; brief: Brief; status: "draft" | "reviewed"; saved?: StoredDraft };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", ...options?.headers } });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request failed. Your unsaved text is still here.");
  return result;
}

function draftInput(draft: Draft): DraftInput {
  return { ...draft.brief, body: draft.content, status: draft.status };
}

function isDirty(draft: Draft) {
  return !draft.saved || Object.entries(draftInput(draft)).some(([key, value]) => draft.saved?.[key as keyof StoredDraft] !== value);
}

export default function Home() {
  const [brief, setBrief] = useState<Brief>(sampleBrief);
  const [errors, setErrors] = useState<BriefErrors>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [library, setLibrary] = useState<DraftSummary[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState("");
  const [signInUrl, setSignInUrl] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<DraftSummary | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const storagePending = useRef(false);
  const sequence = useRef(0);
  const draft = drafts.find((item) => item.id === activeId);

  async function loadLibrary() {
    try {
      const response = await fetch("/api/drafts", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const result = await response.json() as { drafts?: DraftSummary[]; error?: string; signInUrl?: string };
      if (response.status === 401) setSignInUrl(result.signInUrl || "");
      if (!response.ok) throw new Error(result.error || "The library could not be loaded.");
      setLibraryError("");
      setSignInUrl("");
      setLibrary(result.drafts || []);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "The library could not be loaded.");
    } finally { setLibraryLoading(false); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/drafts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { drafts?: DraftSummary[]; error?: string; signInUrl?: string };
        if (response.status === 401) setSignInUrl(result.signInUrl || "");
        if (!response.ok) throw new Error(result.error || "The library could not be loaded.");
        setLibrary(result.drafts || []);
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setLibraryError(error instanceof Error ? error.message : "The library could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLibraryLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (deleteCandidate) dialog.current?.showModal();
    else dialog.current?.close();
  }, [deleteCandidate]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (drafts.some(isDirty)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [drafts]);

  function change<K extends keyof Brief>(key: K, value: Brief[K]) {
    setBrief((previous) => ({ ...previous, [key]: value }));
    setDrafts((previous) => previous.map((item) => item.id === activeId ? { ...item, brief: { ...item.brief, [key]: value } } : item));
    setNotice("");
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function activate(item: Draft) {
    setActiveId(item.id);
    setBrief(item.brief);
    setErrors({});
    setNotice("");
    setError("");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || storagePending.current) return;
    const nextErrors = validateBrief(brief);
    setErrors(nextErrors);
    setError("");
    setNotice("");
    if (Object.keys(nextErrors).length) {
      document.getElementById(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const [result] = await Promise.all([
        api<{ mode: string; content: string }>("/api/generate", { method: "POST", body: JSON.stringify(brief) }),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      if (result.mode !== "demo" || typeof result.content !== "string" || !result.content.trim()) throw new Error("Invalid demo response");
      const item: Draft = { id: ++sequence.current, requestId: crypto.randomUUID(), content: result.content, brief: { ...brief }, status: "draft" };
      setDrafts((previous) => [...previous, item]);
      activate(item);
    } catch {
      setError("We couldn’t prepare your demo draft. Your brief and existing drafts are unchanged. Try Generate drafts again.");
    } finally { pending.current = false; setLoading(false); }
  }

  async function save() {
    if (!draft || storagePending.current || pending.current) return;
    setErrors(validateBrief(draft.brief));
    const parsed = draftInputSchema.safeParse(draftInput(draft));
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    storagePending.current = true;
    setStorageBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ draft: StoredDraft }>(draft.saved ? `/api/drafts/${draft.saved.id}` : "/api/drafts", {
        method: draft.saved ? "PUT" : "POST",
        headers: draft.saved ? { "If-Match": draft.saved.updatedAt } : { "X-Draft-Request-Id": draft.requestId },
        body: JSON.stringify(parsed.data),
      });
      // Only update the saved baseline; edits made while the request ran stay editable.
      setDrafts((previous) => previous.map((item) => item.id === draft.id ? { ...item, saved: result.draft } : item));
      setNotice("Saved to your library. Any edits made during saving remain unsaved.");
      await loadLibrary();
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed. Your edits are still here."); }
    finally { storagePending.current = false; setStorageBusy(false); }
  }

  async function reopen(id: string) {
    if (storagePending.current || pending.current) return;
    const existing = drafts.find((item) => item.saved?.id === id);
    if (existing && isDirty(existing)) { activate(existing); setNotice("Restored your open edits. Save when ready."); return; }
    storagePending.current = true;
    setStorageBusy(true); setError(""); setNotice("");
    try {
      const { draft: record } = await api<{ draft: StoredDraft }>(`/api/drafts/${id}`);
      const item: Draft = { id: existing?.id || ++sequence.current, requestId: crypto.randomUUID(), content: record.body, brief: { topic: record.topic, audience: record.audience, channel: record.channel, tone: record.tone, keyPoints: record.keyPoints, callToAction: record.callToAction }, status: record.status, saved: record };
      setDrafts((previous) => existing ? previous.map((entry) => entry.id === existing.id ? item : entry) : [...previous, item]);
      activate(item);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not reopen this draft. Your edits are still here."); }
    finally { storagePending.current = false; setStorageBusy(false); }
  }

  async function confirmDelete() {
    if (!deleteCandidate || storagePending.current) return;
    storagePending.current = true; setStorageBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/drafts/${deleteCandidate.id}`, { method: "DELETE", headers: { "If-Match": deleteCandidate.updatedAt } });
      // Preserve any open text as an unsaved draft after removing its durable record.
      setDrafts((previous) => previous.map((item) => item.saved?.id === deleteCandidate.id ? { ...item, requestId: crypto.randomUUID(), saved: undefined } : item));
      setLibrary((previous) => previous.filter((item) => item.id !== deleteCandidate.id));
      setDeleteCandidate(null);
      setNotice("Deleted from your library. Any open text is still available as an unsaved draft.");
    } catch (error) { setError(error instanceof Error ? error.message : "Delete failed. The draft is still in your library."); setDeleteCandidate(null); }
    finally { storagePending.current = false; setStorageBusy(false); }
  }

  function fieldHint(key: keyof Brief, hint?: string) {
    return <div id={`${key}-hint`} className={errors[key] ? "field-error" : "field-hint"}>{errors[key] || hint}</div>;
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="wordmark" href="#studio-title"><span className="studio-mark" aria-hidden="true">cs.</span>Miami AI School</a>
        <span className="mode-label"><span aria-hidden="true" />Demo studio</span>
      </header>
      <section className="studio-intro" aria-labelledby="studio-title">
        <p className="eyebrow">A little clarity. A better draft.</p>
        <h1 id="studio-title">Content Studio<span aria-hidden="true">.</span></h1>
        <p>Start with an idea. Find the words. Make them yours.</p>
      </section>
      <div className="studio-grid">
        <section className="brief-panel" aria-labelledby="brief-title">
          <div className="section-heading"><span className="section-number">01</span><h2 id="brief-title">The brief</h2><PenLine size={17} aria-hidden="true" /></div>
          <p className="section-description">Give your draft a little direction.</p>
          <form onSubmit={generate} noValidate>
            <fieldset disabled={loading}>
            <p className="form-note">A fictional brief to try. All fields required unless marked optional.</p>
            <div className="field">
              <label htmlFor="topic">Topic</label>
              <input id="topic" value={brief.topic} onChange={(event) => change("topic", event.target.value)} required aria-invalid={!!errors.topic} aria-describedby="topic-hint" />
              <div className="field-meta">{fieldHint("topic", "What do you want to say?")}<span>{brief.topic.length}/300</span></div>
            </div>
            <div className="field">
              <label htmlFor="audience">Audience</label>
              <input id="audience" value={brief.audience} onChange={(event) => change("audience", event.target.value)} required aria-invalid={!!errors.audience} aria-describedby="audience-hint" />
              {fieldHint("audience")}
            </div>
            <div className="field-pair">
              <div className="field"><label htmlFor="channel">Channel</label><select id="channel" value={brief.channel} onChange={(event) => change("channel", event.target.value as Brief["channel"])}><option>LinkedIn</option><option>X</option></select></div>
              <div className="field"><label htmlFor="tone">Tone</label><select id="tone" value={brief.tone} onChange={(event) => change("tone", event.target.value as Brief["tone"])}><option>Practical</option><option>Warm</option><option>Bold</option></select></div>
            </div>
            <div className="field">
              <label htmlFor="keyPoints">Key points</label>
              <textarea id="keyPoints" rows={5} value={brief.keyPoints} onChange={(event) => change("keyPoints", event.target.value)} required aria-invalid={!!errors.keyPoints} aria-describedby="keyPoints-hint" />
              <div className="field-meta">{fieldHint("keyPoints", "The details worth including.")}<span>{brief.keyPoints.length.toLocaleString()}/2,000</span></div>
            </div>
            <div className="field">
              <label htmlFor="callToAction">Call to action <span className="optional">Optional</span></label>
              <input id="callToAction" value={brief.callToAction} onChange={(event) => change("callToAction", event.target.value)} placeholder="What should your reader do next?" />
            </div>
            {Object.keys(errors).some((key) => errors[key as keyof Brief]) && <p className="validation-summary" role="alert">Check the highlighted fields. Your brief is still here.</p>}
            </fieldset>
            <button className="generate-button" type="submit" disabled={loading || storageBusy}>{loading ? <LoaderCircle size={18} className="spinner" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}{loading ? "Preparing demo draft…" : "Generate drafts"}{!loading && <ArrowRight size={18} aria-hidden="true" />}</button>
            <p className="generation-note">Demo output only · No live AI connected</p>
          </form>
        </section>

        <div className="writing-column">
          <section className="workspace-panel" aria-labelledby="workspace-title" aria-busy={loading}>
            <div className="section-heading"><span className="section-number">02</span><h2 id="workspace-title">Draft workspace</h2><span className="small-tag">{draft ? (isDirty(draft) ? "Unsaved changes" : "Saved") : "Your canvas"}</span></div>
            <p className="section-description">A first draft is just the beginning.</p>
            {error && <div className="error-notice" role="alert"><strong>Let’s try that again.</strong><p>{error}</p></div>}
            <div role="status" aria-live="polite">{notice && <p className="success-notice">{notice}</p>}{loading && <div className="loading-notice"><LoaderCircle className="spinner" size={18} aria-hidden="true" /><span>Preparing Demo output. Your existing edits stay safe.</span></div>}</div>
            {draft ? <>
              {drafts.length > 1 && <div className="draft-switcher" aria-label="Draft versions">{drafts.map((item, index) => <button key={item.id} type="button" aria-pressed={item.id === activeId} disabled={loading || storageBusy} onClick={() => activate(item)}>Draft {index + 1}</button>)}</div>}
              <div className="editor-topline"><span className="demo-badge">Demo output</span><span>{draft.brief.channel} · Template sample</span></div>
              <label className="editor-label" htmlFor="draft-content">Edit your draft</label>
              <textarea id="draft-content" className="draft-editor" value={draft.content} onChange={(event) => { setNotice(""); setDrafts((previous) => previous.map((item) => item.id === activeId ? { ...item, content: event.target.value } : item)); }} aria-describedby="draft-length draft-retention" />
              <div className="editor-footer"><span id="draft-length" className={draft.brief.channel === "X" && draft.content.length > 280 ? "field-error" : ""}>{draft.content.length.toLocaleString()} characters{draft.brief.channel === "X" ? " / 280 suggested" : ""}</span><button type="button" className="save-button" disabled={storageBusy || loading} onClick={save}>{storageBusy ? "Working…" : "Save draft"}</button></div>
              {draft.brief.channel === "X" && draft.content.length > 280 && <p className="field-error">Trim this draft to fit a standard X post.</p>}
              <div className="field status-field"><label htmlFor="draft-status">Status</label><select id="draft-status" value={draft.status} onChange={(event) => { setNotice(""); setDrafts((previous) => previous.map((item) => item.id === activeId ? { ...item, status: event.target.value as Draft["status"] } : item)); }}><option value="draft">Draft</option><option value="reviewed">Reviewed</option></select></div>
              <p id="draft-retention" className="retention-note">Save to keep this draft across visits. New generations keep your earlier edits in their own tabs. Demo output is not live AI.</p>
            </> : <div className="workspace-empty">
              <div className="paper-motif" aria-hidden="true"><FileText size={34} strokeWidth={1.2} /><span /></div>
              <h3>{loading ? "Finding the first words…" : "Your next draft starts here."}</h3>
              <p>{loading ? "We’re assembling a template sample from your brief." : "Complete the brief and select Generate drafts. Then shape the demo into your own words."}</p>
              <span className="empty-caption">{loading ? "Demo output · No live AI" : "Room to think. Space to edit."}</span>
            </div>}
          </section>
          <section className="library-panel" aria-labelledby="library-title">
            <div className="section-heading"><span className="section-number">03</span><h2 id="library-title">Saved library</h2><span className="library-count">{library.length}</span></div>
            <button type="button" className="text-button" disabled={libraryLoading || storageBusy} onClick={() => { setLibraryLoading(true); void loadLibrary(); }}>Refresh library</button>
            {libraryLoading && <p className="retention-note" role="status">Loading your library…</p>}
            {libraryError && <div className="error-notice" role="alert"><p>{libraryError}</p>{signInUrl ? <a href={signInUrl} target="_top">Sign in with ChatGPT</a> : <button type="button" className="text-button" onClick={loadLibrary}>Retry library</button>}</div>}
            {!libraryLoading && !libraryError && !library.length && <div className="library-empty"><BookOpen size={25} strokeWidth={1.3} aria-hidden="true" /><div><h3>A home for the keepers.</h3><p>Save a draft and find it here when you return.</p></div></div>}
            <ul className="library-list">{library.map((item) => <li key={item.id}><button type="button" className="library-open" disabled={storageBusy || loading} onClick={() => reopen(item.id)}><strong>{item.topic}</strong><span>{item.channel} · {item.status} · Demo output</span><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleString()}</time></button><button type="button" className="delete-button" disabled={storageBusy || loading} onClick={() => setDeleteCandidate(item)} aria-label={`Delete ${item.topic}`}>Delete</button></li>)}</ul>
          </section>
        </div>
      </div>
      <dialog ref={dialog} className="delete-dialog" onCancel={(event) => { if (storageBusy) event.preventDefault(); else setDeleteCandidate(null); }} aria-labelledby="delete-title" aria-describedby="delete-description">
        <h2 id="delete-title">Delete this saved draft?</h2><p id="delete-description">“{deleteCandidate?.topic}” will be permanently removed from your library. Any text already open in the workspace will be kept as an unsaved draft.</p>
        <div><button type="button" autoFocus disabled={storageBusy} onClick={() => setDeleteCandidate(null)}>Keep draft</button><button type="button" className="confirm-delete" disabled={storageBusy} onClick={confirmDelete}>{storageBusy ? "Deleting…" : "Delete permanently"}</button></div>
      </dialog>
      <footer className="studio-footer"><span>Made for a thoughtful first draft.</span><span>Miami AI School <span aria-hidden="true">↗</span></span></footer>
    </main>
  );
}
