import { strToU8, zipSync } from 'fflate';
export function personalDataZip(pack: { attachments: { path: string; base64: string }[]; [key: string]: unknown }) {
  const { attachments, ...metadata } = pack;
  const files: Record<string, Uint8Array> = { 'subject-access-review.json': strToU8(JSON.stringify(metadata, null, 2)) };
  for (const file of attachments) {
    // Never allow archive traversal through a historic file name.
    const safe = file.path.split('/').map(part => part.replace(/[^a-zA-Z0-9_.-]/g, '_')).filter(part => part !== '.' && part !== '..').join('/');
    files[`attachments/${safe}`] = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
  }
  return zipSync(files);
}