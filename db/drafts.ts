import { getD1 } from "./index";
import type { DraftInput, DraftSummary, StoredDraft } from "@/lib/drafts";

const columns = `id, topic, audience, channel, tone, key_points AS keyPoints,
  call_to_action AS callToAction, body, status, created_at AS createdAt, updated_at AS updatedAt`;

export async function listDrafts(ownerId: string) {
  const result = await getD1().prepare(`SELECT id, topic, channel, status, updated_at AS updatedAt FROM drafts WHERE owner_id = ? ORDER BY updated_at DESC, id DESC`).bind(ownerId).all<DraftSummary>();
  return result.results;
}

export function readDraft(ownerId: string, id: string) {
  return getD1().prepare(`SELECT ${columns} FROM drafts WHERE id = ? AND owner_id = ?`).bind(id, ownerId).first<StoredDraft>();
}

export function createDraft(ownerId: string, data: DraftInput, id = crypto.randomUUID()) {
  const now = new Date().toISOString();
  return getD1().prepare(`INSERT INTO drafts (id, owner_id, topic, audience, channel, tone, key_points, call_to_action, body, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING ${columns}`)
    .bind(id, ownerId, data.topic, data.audience, data.channel, data.tone, data.keyPoints, data.callToAction, data.body, data.status, now, now).first<StoredDraft>();
}

export function updateDraft(ownerId: string, id: string, version: string, data: DraftInput) {
  const updatedAt = new Date(Math.max(Date.now(), (Date.parse(version) || 0) + 1)).toISOString();
  return getD1().prepare(`UPDATE drafts SET topic = ?, audience = ?, channel = ?, tone = ?, key_points = ?, call_to_action = ?, body = ?, status = ?, updated_at = ?
    WHERE id = ? AND owner_id = ? AND updated_at = ? RETURNING ${columns}`)
    .bind(data.topic, data.audience, data.channel, data.tone, data.keyPoints, data.callToAction, data.body, data.status, updatedAt, id, ownerId, version).first<StoredDraft>();
}

export function deleteDraft(ownerId: string, id: string, version: string) {
  return getD1().prepare("DELETE FROM drafts WHERE id = ? AND owner_id = ? AND updated_at = ? RETURNING id").bind(id, ownerId, version).first<{ id: string }>();
}
