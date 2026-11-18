// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { attachmentError, attachmentMime, ATTACHMENT_LIMIT, canRemoveAttachment, fileSha256 } from './attachments';
import { personalDataZip } from './privacy-zip';
import { unzipSync, strFromU8 } from 'fflate';
describe('attachment validation', () => {
  for (const extension of ['pdf','png','jpg','jpeg','webp','heic','txt','csv','eml','msg','docx','xlsx']) it(`accepts ${extension} within 20 MB`, () => {
    expect(attachmentError({ name: `evidence.${extension.toUpperCase()}`, type: '', size: ATTACHMENT_LIMIT })).toBeNull();
    expect(attachmentMime(`evidence.${extension}`)).not.toBeNull();
  });
  it('rejects oversized files and executable/disguised types', () => {
    expect(attachmentError({ name: 'a.pdf', size: ATTACHMENT_LIMIT + 1, type: 'application/pdf' })).toContain('20 MB');
    expect(attachmentError({ name: 'a.exe', size: 12, type: '' })).not.toBeNull();
    expect(attachmentError({ name: 'a.pdf', size: 12, type: 'application/x-msdownload' })).toContain('does not match');
  });
  it('hashes actual bytes with SHA-256', async () => expect(await fileSha256(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
  it('manager or uploader within 15 minutes only, with locks and read-only excluded', () => {
    const now = Date.parse('2026-11-18T08:00:00Z');
    const row = { uploaded_by: 'u', uploaded_at: '2026-11-18T07:45:00Z', removed_at: null };
    expect(canRemoveAttachment('agent','u',row,false,now)).toBe(true);
    expect(canRemoveAttachment('agent','u',row,false,now+1)).toBe(false);
    expect(canRemoveAttachment('qa_reviewer','other',row,false,now)).toBe(false);
    expect(canRemoveAttachment('complaints_manager','other',row,false,now+1)).toBe(true);
    expect(canRemoveAttachment('read_only','u',row,false,now)).toBe(false);
    expect(canRemoveAttachment('org_admin','u',row,true,now)).toBe(false);
  });
  it('ZIP includes metadata and file bytes with safe paths, never inline base64', () => {
    const zip = unzipSync(personalDataZip({ tables: { complaint_attachments: [{ file_name: 'a.txt' }] }, attachments: [{ path: '../../org/a.txt', base64: btoa('evidence') }] }));
    expect(strFromU8(zip['attachments/org/a.txt'] ?? new Uint8Array())).toBe('evidence');
    expect(JSON.parse(strFromU8(zip['subject-access-review.json'] ?? new Uint8Array()))).toEqual({ tables: { complaint_attachments: [{ file_name: 'a.txt' }] } });
  });
});