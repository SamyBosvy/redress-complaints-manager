import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { AccessibleField } from './accessible-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CURRENCIES } from '@/lib/currencies';
import { closeComplete, type CloseChecklist } from '@/lib/workflow';
import type { Database } from '@/integrations/supabase/types';

type Case = Database['public']['Tables']['complaints']['Row'];
type ChecklistCase = Partial<Pick<Case,'outcome'|'root_cause_category'|'withdrawal_reason'|'adr_rights_given'|'redress_none'|'goodwill_none'|'redress_amount'|'goodwill_amount'|'redress_currency'|'goodwill_currency'>>;
export function CloseChecklistDialog({ c, finalSent, baseCurrency, onClose, onSave }: { c: ChecklistCase; finalSent: boolean; baseCurrency: string; onClose: () => void; onSave: (p: Database['public']['Tables']['complaints']['Update']) => Promise<boolean> }) {
  const [v,setV] = useState<CloseChecklist>({ outcome:c.outcome ?? '', rootCause:c.root_cause_category ?? '', withdrawalReason:c.withdrawal_reason ?? '', finalSent, adr:c.adr_rights_given ?? false, redressNone:c.redress_none ?? false, goodwillNone:c.goodwill_none ?? false, redress:c.redress_amount?.toString() ?? '', goodwill:c.goodwill_amount?.toString() ?? '', redressCurrency:c.redress_currency ?? baseCurrency, goodwillCurrency:c.goodwill_currency ?? baseCurrency });
  const [busy,setBusy] = useState(false);
  const field = <K extends keyof CloseChecklist>(key: K, value: CloseChecklist[K]) => setV(old => ({...old,[key]:value}));
  return <Dialog open onOpenChange={open => {if(!open && !busy)onClose();}}><DialogContent className="flex max-h-[90dvh] flex-col"><DialogHeader><DialogTitle>Close checklist</DialogTitle></DialogHeader><div className="min-h-0 space-y-4 overflow-y-auto">
    <p className="text-sm">{finalSent ? 'Final response recorded as sent.' : 'A sent final response or a withdrawal reason is required.'}</p>
    <AccessibleField label="Outcome"><Select value={v.outcome} onValueChange={value=>field('outcome',value)}><SelectTrigger><SelectValue placeholder="Choose outcome"/></SelectTrigger><SelectContent>{Object.entries({upheld:'Upheld',partially_upheld:'Partially upheld',not_upheld:'Not upheld',withdrawn:'Withdrawn'}).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></AccessibleField>
    {v.outcome==='withdrawn' && <AccessibleField label="Withdrawal reason"><Input value={v.withdrawalReason} maxLength={1000} onChange={e=>field('withdrawalReason',e.target.value)}/></AccessibleField>}
    <AccessibleField label="Root cause"><Input value={v.rootCause} maxLength={100} onChange={e=>field('rootCause',e.target.value)}/></AccessibleField>
    {(['redress','goodwill'] as const).map(kind=><div key={kind} className="space-y-2"><AccessibleField label={kind==='redress'?'No redress payment':'No goodwill payment'}><Checkbox checked={v[`${kind}None`]} onCheckedChange={checked=>setV(old=>({...old,[`${kind}None`]:checked===true,[kind]:checked===true?'':old[kind]}))}/></AccessibleField><div className="grid grid-cols-[1fr_100px] gap-2"><AccessibleField label={`${kind==='redress'?'Redress':'Goodwill'} amount`}><Input type="number" min={0} step="0.01" disabled={v[`${kind}None`]} value={v[kind]} onChange={e=>field(kind,e.target.value)}/></AccessibleField><AccessibleField label={`${kind==='redress'?'Redress':'Goodwill'} currency`}><Select disabled={v[`${kind}None`]} value={v[`${kind}Currency`]} onValueChange={value=>field(`${kind}Currency`,value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CURRENCIES.map(code=><SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></AccessibleField></div></div>)}
    <AccessibleField label="ADR referral rights given"><Checkbox checked={v.adr} onCheckedChange={checked=>field('adr',checked===true)}/></AccessibleField>
    </div><DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button className="min-h-12" disabled={busy || !closeComplete(v)} onClick={async()=>{setBusy(true);try {if(await onSave({status:'closed',outcome:v.outcome as Case['outcome'],root_cause_category:v.rootCause.trim(),withdrawal_reason:v.withdrawalReason.trim() || null,adr_rights_given:v.adr,redress_none:v.redressNone,goodwill_none:v.goodwillNone,redress_amount:v.redressNone?null:Number(v.redress),redress_currency:v.redressNone?null:v.redressCurrency,goodwill_amount:v.goodwillNone?null:Number(v.goodwill),goodwill_currency:v.goodwillNone?null:v.goodwillCurrency}))onClose();}finally{setBusy(false);}}}>{busy?'Saving…':'Confirm closure'}</Button></DialogFooter></DialogContent></Dialog>;
}