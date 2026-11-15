import type { AppRole } from './org';

export const BULK_BATCH_SIZE = 50;
export type BulkCase = { id: string | null; reference: string | null; status: string | null };
export function selectRange(selected: readonly string[], pageIds: readonly string[], anchor: number, index: number, checked: boolean) {
  const next = new Set(selected);
  const start = anchor < 0 ? index : Math.min(anchor, index);
  for (const id of pageIds.slice(start, Math.max(anchor, index) + 1)) {
    if (checked) next.add(id); else next.delete(id);
  }
  return [...next];
}
export function selectAllMatching<T extends BulkCase>(rows: readonly T[]): T[] {
  return [...new Map(rows.filter(row => row.id).map(row => [row.id, row])).values()];
}
export function splitClosed<T extends BulkCase>(rows: readonly T[]) {
  return { eligible: rows.filter(row => row.id && row.status !== 'closed'), skipped: rows.filter(row => row.status === 'closed') };
}
export function bulkBatches<T>(rows: readonly T[]): T[][] {
  return Array.from({ length: Math.ceil(rows.length / BULK_BATCH_SIZE) }, (_, i) => rows.slice(i * BULK_BATCH_SIZE, (i + 1) * BULK_BATCH_SIZE));
}
export function bulkPermissions(role: AppRole | null | undefined) {
  return { reassign: role === 'org_admin' || role === 'complaints_manager', priority: !!role && role !== 'read_only' };
}
export type BulkResult = { updated: number; failed: string[]; skipped: string[] };
export function resultSummary(result: BulkResult) {
  return `${result.updated} updated, ${result.failed.length} failed, ${result.skipped.length} closed cases skipped`;
}