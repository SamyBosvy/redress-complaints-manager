import {createFileRoute} from '@tanstack/react-router';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {supabase} from '@/integrations/supabase/client';
import {useMembership} from '@/lib/org';
import {pageHead} from '@/lib/settings';
import {COUNTRIES,LICENCE_LABELS} from '@/lib/countries';
import {Field,Pick} from '@/components/settings/controls';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Switch} from '@/components/ui/switch';
import {Button} from '@/components/ui/button';
import type {Organisation} from '@/lib/org';
export const Route=createFileRoute('/_authenticated/app/settings/')({head:()=>pageHead('Organisation settings','Firm identity, currency and security requirements.'),component:OrganisationPage});
function OrganisationPage(){const m=useMembership();return m?.org?<OrganisationForm key={m.org.id} org={m.org} edit={m.role==='org_admin'}/>:null;}
function OrganisationForm({org,edit}:{org:Organisation;edit:boolean}){const [v,set]=useState(org);const [busy,setBusy]=useState(false);const qc=useQueryClient();async function save(e:React.FormEvent){e.preventDefault();if(!v.legal_name.trim()||! /^[A-Z]{3}$/.test(v.base_currency)){toast.error('Enter a firm name and three-letter currency code.');return;}if(v.require_2fa&&!org.require_2fa){const {data}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(data?.currentLevel!=='aal2'){toast.error('Verify your authenticator in Account before requiring 2FA.');return;}}setBusy(true);const {error}=await supabase.from('organisations').update({legal_name:v.legal_name.trim(),licence_type:v.licence_type,home_country:v.home_country,regulator:v.regulator,firm_address:v.firm_address,base_currency:v.base_currency,require_2fa:v.require_2fa}).eq('id',org.id);setBusy(false);if(error){toast.error(error.message);return;}await qc.invalidateQueries({queryKey:['membership']});toast.success('Organisation saved.');}return <form onSubmit={save} className="max-w-3xl space-y-5"><h2 className="font-semibold">Organisation</h2><fieldset disabled={!edit||busy} className="grid gap-4 sm:grid-cols-2"><Field label="Legal entity name"><Input required maxLength={200} value={v.legal_name} onChange={e=>set({...v,legal_name:e.target.value})}/></Field><Field label="Licence type"><Pick value={v.licence_type} options={LICENCE_LABELS} onChange={x=>set({...v,licence_type:x as Organisation['licence_type']})}/></Field><Field label="Home country"><Pick value={v.home_country??''} options={COUNTRIES} onChange={x=>set({...v,home_country:x})}/></Field><Field label="Regulator"><Input value={v.regulator??''} onChange={e=>set({...v,regulator:e.target.value})}/></Field><div className="sm:col-span-2"><Field label="Firm address"><Textarea value={v.firm_address} maxLength={2000} onChange={e=>set({...v,firm_address:e.target.value})}/></Field></div><Field label="Base currency"><Input maxLength={3} value={v.base_currency} onChange={e=>set({...v,base_currency:e.target.value.toUpperCase()})}/></Field><label className="flex items-center gap-3 text-sm"><Switch checked={v.require_2fa} onCheckedChange={x=>set({...v,require_2fa:x})}/>Require 2FA for all members</label></fieldset>{edit&&<Button disabled={busy}>Save organisation</Button>}</form>;}
