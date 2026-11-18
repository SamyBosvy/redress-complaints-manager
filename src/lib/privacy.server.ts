import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { PrivacyRow } from './privacy';
type Client = SupabaseClient<Database>;
export async function privacyAdmin(client: Client, userId: string) {
  const { data, error } = await client.from('org_members').select('org_id, role, organisations(*)').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data || data.role !== 'org_admin' || !data.organisations) throw new Error('Only Org Admins can manage personal data.');
  return data.organisations;
}
export async function allRows(client: Client, table: Exclude<keyof Database['public']['Tables'], 'profiles' | 'organisations'>, orgId: string) {
  const out: PrivacyRow[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client.from(table).select('*').eq('org_id', orgId).order(table === 'org_privacy_settings' ? 'org_id' : 'id').range(start, start + 499);
    if (error) throw error;
    out.push(...data as unknown as PrivacyRow[]);
    if (data.length < 500) break;
  }
  return out;
}
export async function storagePaths(client: Client, bucket: string, prefix: string): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const object of data) {
      const path = `${prefix}/${object.name}`;
      if (object.id) paths.push(path); else paths.push(...await storagePaths(client, bucket, path));
    }
    if (data.length < 100) break;
  }
  return paths;
}
export async function removeFiles(client: Client, bucket: string, prefix: string) {
  const paths = await storagePaths(client, bucket, prefix);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await client.storage.from(bucket).remove(paths.slice(i, i + 100));
    if (error) throw error;
  }
}
export async function exportFiles(client: Client, bucket: string, prefixes: string[], allowedPaths?: ReadonlySet<string>) {
  const files: { bucket: string; path: string; contentType: string; base64: string }[] = [];
  for (const prefix of prefixes) for (const path of await storagePaths(client, bucket, prefix)) {
    if (allowedPaths && !allowedPaths.has(path)) continue;
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) throw error;
    files.push({ bucket, path, contentType: data.type, base64: Buffer.from(await data.arrayBuffer()).toString('base64') });
  }
  return files;
}