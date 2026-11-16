import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { erasureSchema, retentionYearsSchema, type PrivacyRow } from './privacy';

export const getPrivacyOverview = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { privacyAdmin, allRows } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { data: settings, error } = await context.supabase.from('org_privacy_settings').select('*').eq('org_id', org.id).maybeSingle();
  if (error) throw error;
  const rows = await allRows(context.supabase, 'complaints', org.id);
  return { org, settings, cases: rows.map(c => ({ id: String(c['id']), reference: String(c['reference']), complainant_name: String(c['complainant_name']), complainant_email: c['complainant_email'] as string | null, customer_ref: c['customer_ref'] as string | null, status: String(c['status']), closed_at: c['closed_at'] as string | null, legal_hold: Boolean(c['legal_hold']), anonymised_at: c['anonymised_at'] as string | null })) };
});
export const setPrivacyRetention = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => retentionYearsSchema.parse(v)).handler(async ({ context, data }) => {
  const { privacyAdmin } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.rpc('privacy_set_retention', { _org: org.id, _years: data });
  if (error) throw error;
  return { ok: true };
});
export const setCaseLegalHold = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ caseId: z.string().uuid(), held: z.boolean() }).parse(v)).handler(async ({ context, data }) => {
  const { privacyAdmin } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.rpc('privacy_change_hold', { _org: org.id, _case: data.caseId, _held: data.held, _actor: context.userId });
  if (error) throw new Error('Could not change the legal hold; privacy processing may already be in progress.');
  return { ok: true };
});
export const eraseWorkingRecords = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => erasureSchema.parse(v)).handler(async ({ context, data }) => {
  const { privacyAdmin, removeFiles } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { data: c, error } = await context.supabase.from('complaints').select('reference,status,closed_at,legal_hold,anonymised_at').eq('org_id', org.id).eq('id', data.caseId).single();
  if (error || !c || c.reference !== data.reference) throw new Error('Enter the exact complaint reference.');
  if (c.status !== 'closed' || !c.closed_at || c.legal_hold || c.anonymised_at) throw new Error('Only closed, non-anonymised complaints without a legal hold are eligible.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error: claimError } = await supabaseAdmin.rpc('privacy_claim_case', { _org: org.id, _case: data.caseId, _retention: false });
  if (claimError) throw new Error('The complaint is no longer eligible for erasure.');
  // Erase file contents first. A failed removal must not be reported as successful erasure.
  await removeFiles(supabaseAdmin, 'attachments', `${org.id}/${data.caseId}`);
  const { error: erased } = await supabaseAdmin.rpc('privacy_anonymise_case', { _org: org.id, _case: data.caseId, _reason: data.lawfulBasis, _actor: context.userId, _retention: false });
  if (erased) throw erased;
  return { ok: true };
});
export const exportPersonalData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ caseId: z.string().uuid() }).parse(v)).handler(async ({ context, data }) => {
  const { privacyAdmin, allRows, exportFiles } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const all = await allRows(context.supabase, 'complaints', org.id);
  const selected = all.find(c => c['id'] === data.caseId);
  if (!selected) throw new Error('Complaint not found.');
  const complaints = all.filter(c => c['id'] === data.caseId || (selected['customer_ref'] && c['customer_ref'] === selected['customer_ref']) || (selected['complainant_email'] && String(c['complainant_email']).toLowerCase() === String(selected['complainant_email']).toLowerCase()));
  const ids = new Set(complaints.map(c => String(c['id'])));
  const tables: Record<string, PrivacyRow[]> = { complaints };
  for (const table of ['complaint_events','letters','qa_reviews','public_form_submissions','adr_cases'] as const) tables[table] = (await allRows(context.supabase, table, org.id)).filter(r => ids.has(String(r['complaint_id'])));
  tables['audit_log'] = (await allRows(context.supabase, 'audit_log', org.id)).filter(r => ids.has(String(r['row_id'])) || ids.has(String((r['after'] as Record<string, unknown> | null)?.['complaint_id'])) || ids.has(String((r['before'] as Record<string, unknown> | null)?.['complaint_id'])));
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const attachments = await exportFiles(supabaseAdmin, 'attachments', [...ids].map(id => `${org.id}/${id}`));
  const { error } = await supabaseAdmin.from('privacy_operations').insert({ org_id: org.id, actor: context.userId, complaint_id: data.caseId, kind: 'subject_access_export', detail: { case_count: ids.size } });
  if (error) throw error;
  return { generatedAt: new Date().toISOString(), firm: org.legal_name, scope: 'Selected complaint plus exact matching customer ID or email; review identity matches and redact third-party/internal information before disclosure.', tables, attachments };
});
export const exportOrganisationData = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { privacyAdmin, allRows, exportFiles } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const tables: Record<string, PrivacyRow[]> = { organisations: [org] };
  for (const table of ['org_members','org_countries','holidays','rule_sets','rule_set_assignments','complaints','complaint_events','letters','templates','notifications','qa_reviews','public_complaint_forms','public_form_submissions','org_privacy_settings','privacy_operations','audit_log','adr_cases'] as const) tables[table] = await allRows(supabaseAdmin, table, org.id);
  const userIds = (tables['org_members'] ?? []).map(r => String(r['user_id']));
  tables['profiles'] = [];
  for (let i=0;i<userIds.length;i+=100) {
    const { data, error } = await supabaseAdmin.from('profiles').select('*').in('id',userIds.slice(i,i+100));
    if(error) throw error;
    tables['profiles'].push(...data);
  }
  const attachments = [...await exportFiles(supabaseAdmin,'attachments',[org.id]), ...await exportFiles(supabaseAdmin,'firm-logos',[org.id])];
  const { error } = await supabaseAdmin.from('privacy_operations').insert({ org_id: org.id, actor: context.userId, kind: 'organisation_export' });
  if (error) throw error;
  return { generatedAt: new Date().toISOString(), firm: org.legal_name, tables, attachments };
});
export const requestOrganisationDeletion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ confirmation: z.string().min(1).max(200) }).parse(v)).handler(async ({ context, data }) => {
  const { privacyAdmin } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.rpc('privacy_request_org_deletion', { _org: org.id, _confirm: data.confirmation });
  if (error) throw error;
  return { ok: true };
});
export const cancelOrganisationDeletion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { privacyAdmin } = await import('./privacy.server');
  const org = await privacyAdmin(context.supabase, context.userId);
  const { error } = await context.supabase.rpc('privacy_cancel_org_deletion', { _org: org.id });
  if (error) throw error;
  return { ok: true };
});