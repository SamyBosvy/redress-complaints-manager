import { describe, expect, it } from 'vitest';
import { readImportFile } from './import-file';
function localFile(name: string, bytes: Uint8Array) { return { name, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as File; }
describe('local import readers', () => {
  it('detects UTF-8 BOM and semicolon CSV', async () => {
    const result = await readImportFile(localFile('test.csv', new TextEncoder().encode('\ufeffName;Summary\r\nŁukasz;Réclamation')));
    expect(result.headers).toEqual(['Name','Summary']);
    expect(result.rows).toEqual([{ Name: 'Łukasz', Summary: 'Réclamation' }]);
    expect(result.detail).toBe('UTF-8 with BOM · delimiter ;');
  });
  it('rejects invalid UTF-8', async () => { await expect(readImportFile(localFile('bad.csv', new Uint8Array([255,254,65])))).rejects.toThrow('UTF-8'); });
  it('reads only the first Excel sheet', async () => {
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Name'],['First']]), 'One');
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Name'],['Second']]), 'Two');
    const result = await readImportFile(localFile('test.xlsx', new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))));
    expect(result.rows).toEqual([{ Name: 'First' }]);
  });
});