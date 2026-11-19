import { CaseTimeline } from '@/components/case-timeline';
import { NoteComposer } from '@/components/note-composer';
import { parseTimelineSearch } from '@/lib/timeline';
import { CaseAttachments } from '@/components/case-attachments';
import { SupportNeeds } from '@/components/support-needs';
import { AuditHistory } from '@/components/audit-history';
import { CaseReopen } from '@/components/case-reopen';
import { CaseAdr } from '@/components/case-adr';
import { EditComplaintDetails } from '@/components/edit-complaint-details';
import { canEditDetails } from '@/lib/complaint-details';
import { rootCausesQuery,type RootCause } from '@/lib/root-causes';
import { RootCauseSelect } from '@/components/root-cause-select';
import { CloseChecklistDialog } from '@/components/close-checklist';
import { nextStatuses, transitionRequirement, workflowError } from '@/lib/workflow';
import { AccessibleField } from '@/components/accessible-field';
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeadlineClock } from "@/components/deadline-clock";
import { StatusPill } from "@/components/status-pill";
import { CustomerHistory } from '@/components/customer-history';
import { CaseLetters } from '@/components/case-letters';
import { caseLettersQuery } from '@/lib/case-letters-query';
import { matchLetterEvent } from '@/lib/case-letters';
import {DeadlineRecalculation} from '@/components/deadline-recalculation';
import {canRecalculate} from '@/lib/workspace-access';
import { membershipQuery, useMembership } from "@/lib/org";
import { COUNTRIES } from "@/lib/countries";
import { letterTemplateFor } from "@/lib/template-language";
import { CATEGORIES, CHANNELS, LANGUAGES, PRODUCTS, STATUSES, countriesQuery, membersQuery, type Status } from "@/lib/complaints";
import { CUSTOM_LETTER_NOTE, caseMergeValues, composerGroups, formatDate, hasAdrBlock, isFinal, letterTypeLabel, mergeTemplate, needsAdrBlock, parseChoice, statusAfterLetter, type CustomLetterType } from "@/lib/letters";
import { customLetterTypesQuery } from "@/lib/custom-letter-types";
import { SelectGroup, SelectLabel } from "@/components/ui/select";
import { templatesQuery } from "./app.templates";
import type { Database } from "@/integrations/supabase/types";
import { CURRENCIES } from '@/lib/currencies';
import { loadPdfFont } from '@/lib/pdf-font';

const caseQuery = (id: string) =>
  queryOptions({
    queryKey: ["case", id],
    queryFn: async () => {
      const c = await supabase.from("complaint_queue").select("*").eq("id", id).single();
      if (c.error) throw c.error;
      const {data:privacy,error:privacyError}=await supabase.from('complaints').select('privacy_processing,withdrawal_reason,redress_none,goodwill_none,adr_rights_given,root_cause_id').eq('org_id',c.data.org_id ?? '').eq('id',id).single();
      if(privacyError)throw privacyError;
      return { c: {...c.data,...privacy} };
    },
  });

export const Route = createFileRoute("/_authenticated/app/c/$id")({
  validateSearch: parseTimelineSearch,
  loader: async ({ context, params }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if(!m?.org)return;
    const orgId = m.org.id;
    await Promise.all([
      context.queryClient.ensureQueryData(caseQuery(params.id)),
      context.queryClient.ensureQueryData(membersQuery(orgId)),
      context.queryClient.ensureQueryData(templatesQuery(orgId)),
      context.queryClient.ensureQueryData(countriesQuery(orgId)),
    ]);
  },
  head: () => ({ meta: [{ title: "Complaint — Redress" }, { name: "description", content: "Review complaint details, correspondence and the case timeline." }, { property: "og:title", content: "Complaint — Redress" }, { property: "og:description", content: "Review complaint details, correspondence and the case timeline." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: CaseView,
});

type Patch = Database["public"]["Tables"]["complaints"]["Update"];
type Detail = { changes?: Record<string,{old:unknown;new:unknown}>; channel?: string; before?: any; after?: any; reason?: string; template?: string; custom_type_id?: string; custom_type_name?: string; text?: string; comment?: string; path?: string; name?: string };

const OUTCOMES = { upheld: "Upheld", partially_upheld: "Partially upheld", not_upheld: "Not upheld", withdrawn: "Withdrawn" } as const;

function CaseView() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const m = useMembership()!;
  const orgId = m.org!.id;
  const qc = useQueryClient();
  const { data: { c } } = useSuspenseQuery(caseQuery(id));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const {data:causes=[]}=useQuery(rootCausesQuery(orgId));
  const {data:configuredCountries=[]}=useQuery(countriesQuery(orgId));
  const nameOf = (u: string | null | undefined) => (u ? members.find((x) => x.user_id === u)?.name ?? "Unknown user" : "Unassigned");
  const canEdit = !c.anonymised_at && !c.privacy_processing && m.role !== "read_only" && (m.role !== "agent" || !c.assigned_to || c.assigned_to === m.user.id);
  const [closeOpen,setCloseOpen] = useState(false);
  const [nextOpen,setNextOpen] = useState(false);
  const [transitionBusy,setTransitionBusy] = useState(false);
  const [letterOpen, setLetterOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set());
  const [revealLetter, setRevealLetter] = useState<string | null>(null);
  const lettersResult = useQuery(caseLettersQuery(orgId, id, Boolean(c.anonymised_at)));
  const { data: letterTypes = [] } = useQuery(customLetterTypesQuery(orgId));
  const letters = c.anonymised_at ? [] : lettersResult.data ?? [];
  const toggleLetter = (letterId: string) => setExpandedLetters(current => {
    const next = new Set(current);
    if (next.has(letterId)) next.delete(letterId); else next.add(letterId);
    return next;
  });
  const showLetter = (letterId: string) => {
    setExpandedLetters(current => new Set([...current, letterId]));
    setRevealLetter(letterId);
    document.getElementById(`letter-${letterId}`)?.scrollIntoView({ block: 'center' });
    document.getElementById(`letter-${letterId}`)?.focus({ preventScroll: true });
  };

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["case", id] }), qc.invalidateQueries({ queryKey: ["queue"] }), qc.invalidateQueries({ queryKey: ['case-letters', orgId, id] }), qc.invalidateQueries({ queryKey: ['timeline', orgId, id] })]);

  async function update(patch: Patch) {
    const { error } = await supabase.from("complaints").update(patch).eq("id", id);
    if (error) { toast.error(workflowError(error.message)); return false; }
    await refresh();
    return true;
  }

  const status = c.status as Status;

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Queue</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{c.reference}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{c.complainant_name}</h1>
            <StatusPill status={status} />{c.vulnerable&&<span className="rounded border px-2 py-1 text-xs text-muted-foreground">Support needs</span>}<CaseReopen orgId={orgId} id={id} role={m.role} mode={m.org?.reopen_deadline_mode??'restart'} c={c} onSaved={refresh}/>
          </div>
          {c.anonymised_at && <p className="mt-1 text-sm text-muted-foreground">Working records anonymised · Historical audit retained</p>}
          {c.legal_hold && <p className="mt-1 text-sm text-warning">Legal hold · Excluded from retention anonymisation</p>}
          <p className="mt-1 text-sm text-muted-foreground">{CATEGORIES[c.category!]} · {PRODUCTS[c.product!]} · {COUNTRIES[c.country_code!] ?? c.country_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">{c.id && c.org_id && canEditDetails(m.role,m.user.id,c) && <EditComplaintDetails c={{...c,id:c.id,org_id:c.org_id}} countries={configuredCountries.map(x=>x.country_code)} onSaved={refresh}/>} {canEdit && <Button onClick={() => setLetterOpen(true)}>Generate letter</Button>}</div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Handling">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Button variant="outline" disabled={!canEdit || !nextStatuses(status,m.role,m.org?.qa_required ?? false,canEdit).length} onClick={()=>setNextOpen(true)}>Next step</Button></div>
              <Field label="Assigned agent">
                <Select value={c.assigned_to ?? "none"} disabled={!canEdit} onValueChange={(v) => update({ assigned_to: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {members.map((x) => <SelectItem key={x.user_id} value={x.user_id}>{x.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={c.priority!} disabled={!canEdit} onValueChange={(v) => update({ priority: v as "standard" | "high" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="standard">Standard</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Complaint">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item k="Received" v={new Date(c.received_at!).toLocaleString("en-GB")} />
              <Item k="Channel" v={CHANNELS[c.channel!]} />
              <Item k="Email" v={c.complainant_email} />
              <Item k="Phone" v={c.complainant_phone} />
              <Item k="Customer ID" v={c.customer_ref} />
              <Item k="Language" v={LANGUAGES[c.language as keyof typeof LANGUAGES] ?? c.language} />
              <Item k="Vulnerable" v={c.vulnerable ? "Yes" : "No"} />
            </dl>
            <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.summary}</p>
            {c.desired_outcome && <>
              <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outcome the customer wants</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.desired_outcome}</p>
            </>}
          </Card>

          <SupportNeeds org={orgId} id={id} role={m.role} user={m.user.id} assigned={c.assigned_to} locked={Boolean(c.anonymised_at||c.privacy_processing||c.legal_hold||status==='closed')} zone={m.org?.time_zone??'Europe/Dublin'} onSaved={refresh}/>
          <OutcomeCard causes={causes} c={c} baseCurrency={m.org?.base_currency ?? 'EUR'} canEdit={canEdit} onSave={update} />
          <CaseAdr timeZone={m.org?.time_zone??'Europe/Dublin'} orgId={orgId} id={id} role={m.role} userId={m.user.id} c={c} body={configuredCountries.find(x=>x.country_code===c.country_code)?.adr_name ?? ''} currency={m.org?.base_currency ?? 'EUR'} onSaved={refresh}/>
          <CaseLetters letters={letters} loading={lettersResult.isPending} error={lettersResult.isError} anonymised={Boolean(c.anonymised_at)} members={members} reference={c.reference ?? ''} firm={m.org?.legal_name ?? ''} address={m.org?.firm_address} expanded={expandedLetters} onToggle={toggleLetter} revealId={revealLetter} customTypes={letterTypes} onGenerate={canEdit ? () => setLetterOpen(true) : undefined} />

          <CaseAttachments org={orgId} id={id} user={m.user.id} role={m.role} assigned={c.assigned_to} anonymised={Boolean(c.anonymised_at)} processing={Boolean(c.privacy_processing)} legalHold={Boolean(c.legal_hold)} members={members} onSaved={refresh}/>
          <Card title="Internal notes">
            <p className="mb-2 text-xs text-muted-foreground">Never shown to the customer.</p>
            {canEdit && (m.role !== 'agent' || c.assigned_to === m.user.id) && <NoteComposer org={orgId} id={id} onSaved={refresh}/>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Deadlines">
            <dl className="space-y-2 text-sm tabular">
              <Row k="Received" v={formatDate(c.received_at)} />
              <Row k="Acknowledgement due" v={formatDate(c.ack_due)} />
              <Row k="Final response due" v={formatDate(c.final_due)} strike={!!c.holding_sent_at} />
              <Row k="Extended deadline" v={c.holding_sent_at ? formatDate(c.extended_due) : `${formatDate(c.extended_due)} if holding sent`} />
              {c.holding_reason && <Row k="Reason for delay" v={c.holding_reason} />}
            </dl>
            <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">Business days remaining</span>
              <DeadlineClock daysLeft={c.days_left} status={status} due={c.holding_sent_at ? c.extended_due : c.final_due} receivedAt={c.received_at} />
            </div>
            {canRecalculate(m.role,Boolean(c.anonymised_at),c.privacy_processing) && c.country_code && c.product && c.received_at && <DeadlineRecalculation org={orgId} id={id} country={c.country_code} product={c.product} received={c.received_at} dates={{ack_due:c.ack_due,final_due:c.final_due,extended_due:c.extended_due}} onSaved={refresh}/>}
          </Card>

          <CustomerHistory orgId={orgId} currentId={id} identity={c.anonymised_at ? {} : { customerRef: c.customer_ref, email: c.complainant_email }} />

          <CaseTimeline org={orgId} id={id} user={m.user.id} search={Route.useSearch()} onSearch={search => { void navigate({ search, replace: true }); }} nameOf={nameOf} renderEvent={e => <EventLine e={e} types={letterTypes} nameOf={nameOf} letterId={matchLetterEvent(e, letters)} onLetter={showLetter}/>}/>

        </div>
      </div>

      {['org_admin', 'complaints_manager', 'read_only'].includes(m.role ?? '') && <div className="mt-8"><AuditHistory orgId={orgId} role={m.role} zone={m.org?.time_zone ?? 'Europe/Dublin'} filters={{}} caseId={id} /></div>}
      {nextOpen && <Dialog open onOpenChange={setNextOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Next step</DialogTitle></DialogHeader>{nextStatuses(status,m.role,m.org?.qa_required ?? false,canEdit).map(next=>{const requirement=transitionRequirement(next,status,letters,c.holding_reason);return <div key={next} className="space-y-1"><Button className="w-full whitespace-normal" variant="outline" disabled={transitionBusy || (next!=='closed' && (!!requirement || lettersResult.isPending || lettersResult.isError))} onClick={async()=>{if(next==='closed'){setNextOpen(false);setCloseOpen(true);return;}setTransitionBusy(true);try{if(await update({status:next}))setNextOpen(false);}finally{setTransitionBusy(false);}}}>{STATUSES[next]}</Button>{requirement && <p className="text-sm text-muted-foreground">{requirement}</p>}</div>;})}</DialogContent></Dialog>}
      {closeOpen && <CloseChecklistDialog causes={causes} c={c} finalSent={['final_response_sent','escalated_to_adr'].includes(status) && letters.some(l=>l.kind.startsWith('final_') && l.status==='sent')} baseCurrency={m.org?.base_currency ?? 'EUR'} onClose={()=>setCloseOpen(false)} onSave={update}/>}
      {letterOpen && <LetterDialog c={c} onClose={() => setLetterOpen(false)} onSent={refresh} />}
    </div>
  );
}

type Ev = { kind: string; detail: unknown };
function EventLine({ e, types, nameOf, letterId, onLetter }: { e: Ev; types: CustomLetterType[]; nameOf: (u: string | null) => string; letterId?: string | undefined; onLetter: (id: string) => void }) {
  const d = (e.detail ?? {}) as Detail;
  switch (e.kind) {
    case "adr_escalated": case "adr_decision": return <p>{d.text || "ADR working record removed"}</p>;
    case "details_edited": return <div><p>Details updated: {d.reason}</p><ul className="mt-1 space-y-1">{Object.entries(d.changes??{}).map(([key,value])=><li key={key} className="break-words">{key.replace(/_/g," ")}: {String(value.old??"—")} → {String(value.new??"—")}</li>)}</ul></div>;
    case "created": return <p>Complaint logged via {CHANNELS[d.channel as keyof typeof CHANNELS] ?? d.channel}</p>;
    case "status": return <p>Status: {STATUSES[d.before as Status]} → <strong>{STATUSES[d.after as Status]}</strong></p>;
    case "reassigned": return <p>Reassigned: {nameOf(d.before)} → <strong>{nameOf(d.after)}</strong></p>;
    case "deadline": return <p>Deadline: {formatDate(d.before)} → <strong>{formatDate(d.after)}</strong>{d.reason ? ` (${d.reason})` : ""}</p>;
    case "deadline_recalculated": return <p>Deadlines recalculated{d.reason ? `: ${d.reason}` : ''}</p>;
    case "outcome": return <p>Outcome updated: {d.after?.outcome ? OUTCOMES[d.after.outcome as keyof typeof OUTCOMES] : "—"}</p>;
    case "priority": return <p>Priority: {d.before} → <strong>{d.after}</strong></p>;
    case "letter_sent": { const label = letterTypeLabel(String(d.template), d.custom_type_id, types, d.custom_type_name); return <p>{letterId ? <a href={`#letter-${letterId}`} className="text-primary hover:underline" onClick={event => { event.preventDefault(); onLetter(letterId); }}>Letter sent: <strong>{label}</strong></a> : <>Letter sent: <strong>{label}</strong></>}</p>; }
    case "qa_returned": return <p className="whitespace-pre-wrap">Final response returned by QA{d.comment ? `: ${d.comment}` : ''}</p>;
    case "note": return <p className="whitespace-pre-wrap rounded bg-muted px-2 py-1">{d.text}</p>;
    case "attachment": return <p>Attachment added</p>;
    case "attachment_removed": return <p>Attachment removed</p>;
    default: return <p>{e.kind}</p>;
  }
}

function OutcomeCard({ c, causes, baseCurrency, canEdit, onSave }: { causes:RootCause[]; c: any; baseCurrency: string; canEdit: boolean; onSave: (p: Patch) => Promise<boolean> }) {
  const [v, setV] = useState({
    outcome: c.outcome ?? "", redress_amount: c.redress_amount ?? "", redress_currency: c.redress_currency ?? baseCurrency,
    goodwill_amount: c.goodwill_amount ?? "", goodwill_currency: c.goodwill_currency ?? baseCurrency,
    root_cause_id: c.root_cause_id ?? "", root_cause_note: c.root_cause_note ?? "",
  });
  const num = (x: string | number) => (x === "" ? null : Math.max(0, Number(x)));
  return (
    <Card title="Outcome">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Outcome">
          <Select value={v.outcome} disabled={!canEdit} onValueChange={(o) => setV({ ...v, outcome: o })}>
            <SelectTrigger><SelectValue placeholder="Not decided" /></SelectTrigger>
            <SelectContent>{Object.entries(OUTCOMES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Root cause"><RootCauseSelect disabled={!canEdit} value={v.root_cause_id} legacy={c.root_cause_category} causes={causes} onChange={value=>setV({...v,root_cause_id:value})}/></Field>
        <Field label="Redress paid">
          <div className="flex gap-2">
            <Input type="number" min={0} step="0.01" className="tabular" disabled={!canEdit} value={v.redress_amount} onChange={(e) => setV({ ...v, redress_amount: e.target.value })} />
            <Select disabled={!canEdit} value={v.redress_currency} onValueChange={(currency) => setV({ ...v, redress_currency: currency })}>
              <SelectTrigger className="w-24 shrink-0" aria-label="Redress currency"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Field>
        <Field label="Goodwill gesture">
          <div className="flex gap-2">
            <Input type="number" min={0} step="0.01" className="tabular" disabled={!canEdit} value={v.goodwill_amount} onChange={(e) => setV({ ...v, goodwill_amount: e.target.value })} />
            <Select disabled={!canEdit} value={v.goodwill_currency} onValueChange={(currency) => setV({ ...v, goodwill_currency: currency })}>
              <SelectTrigger className="w-24 shrink-0" aria-label="Goodwill currency"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((currency) => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </Field>
        <div className="sm:col-span-2"><Field label="Root cause details"><Textarea rows={2} disabled={!canEdit} value={v.root_cause_note} maxLength={2000} onChange={(e) => setV({ ...v, root_cause_note: e.target.value })} /></Field></div>
      </div>
      {canEdit && (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={async () => {
            if (await onSave({
              outcome: (v.outcome || null) as keyof typeof OUTCOMES | null, redress_amount: num(v.redress_amount), redress_currency: v.redress_amount === "" ? null : v.redress_currency || null,
              goodwill_amount: num(v.goodwill_amount), goodwill_currency: v.goodwill_amount === "" ? null : v.goodwill_currency || null,
              redress_none: false, goodwill_none: false, root_cause_id: v.root_cause_id || null, root_cause_note: v.root_cause_note || null,
            })) toast.success("Outcome saved.");
          }}>Save outcome</Button>
        </div>
      )}
    </Card>
  );
}

function LetterDialog({ c, onClose, onSent }: { c: any; onClose: () => void; onSent: () => Promise<unknown> }) {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data: templates } = useSuspenseQuery(templatesQuery(orgId));
  const { data: countries } = useSuspenseQuery(countriesQuery(orgId));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const { data: types = [] } = useQuery(customLetterTypesQuery(orgId));
  const [choice, setChoice] = useState<string>(c.status === "received" ? "acknowledgement" : "holding");
  const { kind, customTypeId } = parseChoice(choice);
  const customType = types.find(t => t.id === customTypeId) ?? null;
  const sameType = (x: { kind: string; custom_type_id: string | null }) => x.kind === kind && (x.custom_type_id ?? null) === customTypeId;
  const [lang, setLang] = useState<string>(c.language ?? "en");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const adr = countries.find((x) => x.country_code === c.country_code);
  const agent = members.find((x) => x.user_id === (c.assigned_to ?? m.user.id));
  const {data:causes=[]}=useQuery(rootCausesQuery(orgId));

  const key = `${choice}:${lang}`;
  if (loadedKey !== key) {
    const t = templates.find((x) => sameType(x) && x.language === lang) ?? templates.find((x) => sameType(x) && x.language === "en");
    const values = caseMergeValues(c, { firm: m.org?.legal_name ?? '', address: m.org?.firm_address, firmEmail:m.org?.complaints_email, agent: agent?.name, agentEmail:agent?.email, adrName: adr?.adr_name, adrContact: [adr?.adr_contact, adr?.adr_website].filter(Boolean).join(', '), language:lang, extended:kind==='holding', rootCause:causes.find(x=>x.id===c.root_cause_id)?.name??c.root_cause_category??'' });
    setSubject(mergeTemplate(t?.subject ?? "", values));
    setBody(mergeTemplate(t?.body ?? "", values));
    setLoadedKey(key);
  }
  const tpl = templates.find((x) => sameType(x) && x.language === lang);
  const adrMissing = needsAdrBlock(kind, customType) && tpl && !hasAdrBlock(tpl.body);

  const finalBlocked = isFinal(kind) && !["acknowledged","under_investigation","holding_response_sent","reopened"].includes(c.status);
  const draft = isFinal(kind) && m.org?.qa_required;
  async function markSent() {
    if(finalBlocked)return;
    if (kind === "holding" && !reason.trim()) { toast.error("Record the reason for the delay."); return; }
    const { error } = await supabase.from("letters").insert({ org_id: orgId, complaint_id: c.id, kind, custom_type_id: customTypeId, language: lang, subject, body, sent_by: m.user.id });
    if (error) { toast.error(workflowError(error.message)); return; }
    const next = statusAfterLetter(kind, c.status, m.org!.qa_required);
    const patch: Patch = {};
    if (next) patch.status = next as Status;
    if (kind === "holding" && !c.holding_sent_at) { patch.holding_sent_at = new Date().toISOString(); patch.holding_reason = reason.trim().slice(0, 1000); }
    if (Object.keys(patch).length) {
      const { error: e2 } = await supabase.from("complaints").update(patch).eq("id", c.id);
      if (e2) { toast.error(workflowError(e2.message)); await onSent(); onClose(); return; }
    }
    await onSent();
    toast.success(next === "pending_qa" ? "Final response sent to QA for approval." : "Letter recorded as sent.");
    onClose();
  }

  async function pdf() {
    try {
      if (!m.org) return;
      const { letterPdf } = await import('@/lib/letter-pdf');
      const font = await loadPdfFont();
      letterPdf({ firm: m.org.legal_name, address: m.org.firm_address, date: new Date().toLocaleDateString('en-GB'), subject, body }, font).save(`${c.reference}-${kind === 'custom' ? (customType?.name ?? 'custom').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() : kind}.pdf`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not generate PDF.'); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col">
        <DialogHeader><DialogTitle>Generate letter</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger aria-label="Letter type"><SelectValue /></SelectTrigger>
              <SelectContent>{composerGroups(types).map(g => <SelectGroup key={g.label}><SelectLabel>{g.label}</SelectLabel>{g.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectGroup>)}</SelectContent>
            </Select>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger aria-label="Letter language"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(LANGUAGES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {letterTemplateFor(templates, kind, lang, customTypeId).warning && <p role="status" className="text-sm text-warning">{letterTemplateFor(templates, kind, lang, customTypeId).warning}</p>}
          {kind === "custom" && <p className="text-sm text-muted-foreground">{CUSTOM_LETTER_NOTE}</p>}
          {kind === "custom" && !tpl && !templates.some(x => sameType(x)) && <p className="text-sm text-warning">No template saved for this letter type yet.</p>}
          {draft && <p className="text-sm text-warning">Draft — pending QA</p>}
          {finalBlocked && <p className="text-sm text-warning">A final response cannot be re-sent while awaiting QA or after it has been sent.</p>}
          {adrMissing && <p className="text-sm text-warning">This {kind === "custom" ? "letter" : "final response"} template has no ADR referral block.</p>}
          {!adr?.adr_name && isFinal(kind) && <p className="text-sm text-warning">No ADR body is set for this customer's country.</p>}
          <Input aria-label="Letter subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea aria-label="Letter body" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
          {kind === "holding" && (
            <div className="space-y-1.5">
              <Label htmlFor="letter-delay-reason">Reason for the delay *</Label>
              <Input id="letter-delay-reason" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
              <p className="text-xs text-muted-foreground">Sending a holding response moves the deadline to {formatDate(c.extended_due)}.</p>
            </div>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button disabled={!!draft} variant="outline" onClick={() => { void navigator.clipboard.writeText(`${subject}\n\n${body}`); toast.success("Copied."); }}><Copy aria-hidden="true" className="h-4 w-4" /> Copy</Button>
          <Button disabled={!!draft} variant="outline" onClick={pdf}><FileDown aria-hidden="true" className="h-4 w-4" /> Download PDF</Button>
          <Button disabled={finalBlocked} onClick={markSent}>{draft ? "Submit for QA" : "Mark as sent"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border bg-card p-5"><h2 className="mb-4 text-sm font-semibold">{title}</h2>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <AccessibleField label={label}>{children}</AccessibleField>;
}
function Item({ k, v }: { k: string; v: string | null | undefined }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v || "—"}</dd></div>;
}
function Row({ k, v, strike }: { k: string; v: string; strike?: boolean }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className={strike ? "line-through opacity-60" : "text-right"}>{v}</dd></div>;
}
