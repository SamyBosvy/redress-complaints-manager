export const ATTACHMENT_LIMIT = 20 * 1024 * 1024;
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', txt: 'text/plain', csv: 'text/csv', eml: 'message/rfc822', msg: 'application/vnd.ms-outlook', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
export const ATTACHMENT_CATEGORIES = { customer_evidence: 'Customer evidence', firm_document: 'Firm document', correspondence: 'Correspondence', other: 'Other' } as const;
export type AttachmentCategory = keyof typeof ATTACHMENT_CATEGORIES;
export function attachmentMime(name: string) { return ATTACHMENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''] ?? null; }
export function attachmentError(file: { name: string; size: number; type: string }) {
  if (!attachmentMime(file.name)) return 'Use PDF, PNG, JPEG, WEBP, HEIC, TXT, CSV, EML, MSG, DOCX or XLSX.';
  if (!Number.isFinite(file.size) || file.size < 0 || file.size > ATTACHMENT_LIMIT) return 'Files must be 20 MB or smaller.';
  const mime = attachmentMime(file.name);
  // Browsers often supply generic/empty types for mail, HEIC and Office files.
  if (file.type && !['application/octet-stream', 'application/zip'].includes(file.type) && file.type !== mime && !(file.name.toLowerCase().endsWith('.csv') && ['application/vnd.ms-excel', 'text/plain'].includes(file.type))) return 'The file type does not match its extension.';
  return null;
}
export function canRemoveAttachment(role: string | null, user: string, row: { uploaded_by: string | null; uploaded_at: string; removed_at: string | null }, locked: boolean, now = Date.now()) {
  if (locked || row.removed_at || role === 'read_only') return false;
  return role === 'org_admin' || role === 'complaints_manager' || (['agent', 'qa_reviewer'].includes(role ?? '') && row.uploaded_by === user && now - Date.parse(row.uploaded_at) <= 15 * 60 * 1000);
}
export async function fileSha256(file: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}