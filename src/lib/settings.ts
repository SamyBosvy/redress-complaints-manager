import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from './org';
import type { Database } from '@/integrations/supabase/types';
export function pageHead(title: string, description: string) { return { meta: [{ title: `${title} — Redress` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — Redress` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }; }
export async function hashSecret(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
export function inviteState(i: {accepted_at: string|null; revoked_at: string|null; expires_at: string}, now = Date.now()) { return i.accepted_at ? 'Accepted' : i.revoked_at ? 'Revoked' : new Date(i.expires_at).getTime() <= now ? 'Expired' : 'Invited'; }
export function eligibleHandler(m: {active: boolean; role: AppRole}) { return m.active && m.role !== 'read_only'; }
export function canChangeMember(member: {active: boolean; role: AppRole}, role: AppRole, active: boolean, admins: number) { return !(member.active && member.role === 'org_admin' && (!active || role !== 'org_admin') && admins <= 1); }
export type RuleAssignment = {rule_set_id: string; country_code: string|null; product: string|null};
export function effectiveRule(assignments: RuleAssignment[], country: string, product: string, defaultId: string) { return [...assignments].filter(a => (!a.country_code || a.country_code === country) && (!a.product || a.product === product)).sort((a,b) => (Number(!!b.country_code)*2+Number(!!b.product))-(Number(!!a.country_code)*2+Number(!!a.product)))[0]?.rule_set_id ?? defaultId; }
export const settingsQuery = (org: string) => queryOptions({queryKey:['settings',org],queryFn:async()=>{ const [countries,holidays,rules,assignments] = await Promise.all([supabase.from('org_countries').select('*').eq('org_id',org),supabase.from('holidays').select('*').eq('org_id',org).order('holiday_date'),supabase.from('rule_sets').select('*').eq('org_id',org),supabase.from('rule_set_assignments').select('*').eq('org_id',org)]); for(const r of [countries,holidays,rules,assignments]) if(r.error) throw r.error; return {countries:countries.data??[],holidays:holidays.data??[],rules:rules.data??[],assignments:assignments.data??[]}; }});

// Generated RPC types omit SQL nullability; null represents an unrestricted assignment.
export function saveRuleAssignment(org: string, rule: string, country: string | null, product: string | null) {
  const args = {_org: org, _rule: rule, _country: country, _product: product};
  return supabase.rpc('save_rule_assignment', args as Database['public']['Functions']['save_rule_assignment']['Args']);
}
