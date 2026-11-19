import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { publicComplaintSchema, type PublicFormDetails } from './public-forms';
import { PUBLIC_FORM_LANGUAGES } from './public-form-i18n';

function publicClient(url: string, key: string) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
}
export const getPublicForm = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), language: z.enum(PUBLIC_FORM_LANGUAGES).default('en') }).parse(input))
  .handler(async ({ data }): Promise<PublicFormDetails | null> => {
    const client = publicClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!);
    const { data: row, error } = await client.rpc('public_form_details', { _id: data.id, _language: data.language });
    if (error) throw new Error('The complaint form could not be loaded. Please try again.');
    if (!row) return null;
    const parsed = z.object({ id: z.string().uuid(), firm_name: z.string(), privacy_notice: z.string(), notice_language: z.string().nullable(), available_languages: z.array(z.string()), privacy_notice_sha256: z.string(), logo_path: z.string().nullable(), countries: z.array(z.string()) }).parse(row);
    let logo_url: string | null = null;
    if (parsed.logo_path) {
      const browserStorage = publicClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!);
      const { data: signed } = await browserStorage.storage.from('firm-logos').createSignedUrl(parsed.logo_path, 3600);
      if (signed?.signedUrl) {
        const signedUrl = new URL(signed.signedUrl);
        const publicUrl = new URL(import.meta.env['VITE_SUPABASE_URL']);
        signedUrl.host = publicUrl.host; signedUrl.protocol = publicUrl.protocol;
        logo_url = signedUrl.href;
      }
    }
    return { id: parsed.id, firm_name: parsed.firm_name, privacy_notice: parsed.privacy_notice, notice_language: parsed.notice_language, available_languages: parsed.available_languages, privacy_notice_sha256: parsed.privacy_notice_sha256, countries: parsed.countries, logo_url };
  });
export const submitPublicComplaint = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => publicComplaintSchema.parse(input))
  .handler(async ({ data }) => {
    const client = publicClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!);
    const { form_id, submission_id, ...fields } = data;
    const { data: reference, error } = await client.rpc('submit_public_complaint', { _form_id: form_id, _submission_id: submission_id, _data: fields });
    if (error) throw new Error(error.message.startsWith('duplicate key') ? 'Please try again.' : error.message);
    if (!reference) throw new Error('Your complaint could not be saved. Please try again.');
    return { reference };
  });
