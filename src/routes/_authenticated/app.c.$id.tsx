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
import { ArrowLeft, Copy, FileDown, Paperclip } from "lucide-react";
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
import { CATEGORIES, CHANNELS, LANGUAGES, PRODUCTS, STATUSES, countriesQuery, membersQuery, type Status } from "@/lib/complaints";
import { TEMPLATE_KINDS, caseMergeValues, formatDate, hasAdrBlock, isFinal, mergeTemplate, statusAfterLetter, type TemplateKind } from "@/lib/letters";
import { templatesQuery } from "./app.templates";
import type { Database } from "@/integrations/supabase/types";
import { CURRENCIES } from '@/lib/currencies';
import { loadPdfFont } from '@/lib/pdf-font';

const caseQuery = (id: string) =>
  queryOptions({
    queryKey: ["case", id],
    queryFn: async () => {
      const [c, ev] = await Promise.all([
        supabase.from("complaint_queue").select("*").eq("id", id).single(),
        supabase.from("complaint_events").select("*").eq("complaint_id", id).order("created_at", { ascending: false }),
      ]);
      if (c.error) throw c.error;
      if (ev.error) throw ev.error;
      const {data:privacy,error:privacyError}=await supabase.from('complaints').select('privacy_processing,withdrawal_reason,redress_none,goodwill_none,adr_rights_given,root_cause_id').eq('org_id',c.data.org_id ?? '').eq('id',id).single();
      if(privacyError)throw privacyError;
      return { c: {...c.data,...privacy}, events: ev.data };
    },
  });

export const Route = createFileRoute("/_authenticated/app/c/$id")({
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
type Detail = { changes?: Record<string,{old:unknown;new:unknown}>; channel?: string; before?: any; after?: any; reason?: string; template?: string; text?: string; path?: string; name?: string };

const OUTCOMES = { upheld: "Upheld", partially_upheld: "Partially upheld", not_upheld: "Not upheld", withdrawn: "Withdrawn" } as const;

function CaseView() {
  const { id } = Route.useParams();
  const m = useMembership()!;
  const orgId = m.org!.id;
  const qc = useQueryClient();
  const { data: { c, events } } = useSuspenseQuery(caseQuery(id));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const {data:causes=[]}=useQuery(rootCausesQuery(orgId));
  const {data:configuredCountries=[]}=useQuery(countriesQuery(orgId));
  const nameOf = (u: string | null | undefined) => (u ? members.find((x) => x.user_id === u)?.name ?? "Unknown user" : "Unassigned");
  const canEdit = !c.anonymised_at && !c.privacy_processing && m.role !== "read_only" && (m.role !== "agent" || !c.assigned_to || c.assigned_to === m.user.id);
  const [closeOpen,setCloseOpen] = useState(false);
  const [nextOpen,setNextOpen] = useState(false);
  const [transitionBusy,setTransitionBusy] = useState(false);
  const [note, setNote] = useState("");
  const [letterOpen, setLetterOpen] = useState(false);
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(new Set());
  const [revealLetter, setRevealLetter] = useState<string | null>(null);
  const lettersResult = useQuery(caseLettersQuery(orgId, id, Boolean(c.anonymised_at)));
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

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["case", id] }), qc.invalidateQueries({ queryKey: ["queue"] }), qc.invalidateQueries({ queryKey: ['case-letters', orgId, id] })]);

  async function update(patch: Patch) {
    const { error } = await supabase.from("complaints").update(patch).eq("id", id);
    if (error) { toast.error(workflowError(error.message)); return false; }
    await refresh();
    return true;
  }

  async function addNote() {
    if (!note.trim()) return;
    const { error } = await supabase.from("complaint_events").insert({ org_id: orgId, complaint_id: id, actor: m.user.id, kind: "note", detail: { text: note.trim().slice(0, 5000) } });
    if (error) { toast.error(error.message); return; }
    setNote("");
    await refresh();
  }

  async function upload(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("Files must be 20 MB or smaller."); return; }
    const path = `${orgId}/${id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file);
    if (error) { toast.error(error.message); return; }
    await supabase.from("complaint_events").insert({ org_id: orgId, complaint_id: id, actor: m.user.id, kind: "attachment", detail: { path, name: file.name, size: file.size } });
    await refresh();
    toast.success("Attachment added.");
  }

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank", "noopener");
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
            <StatusPill status={status} />
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
              {c.vulnerable && <Item k="Vulnerable customer" v={c.vulnerable_note || "Yes"} />}
            </dl>
            <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.summary}</p>
            {c.desired_outcome && <>
              <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outcome the customer wants</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.desired_outcome}</p>
            </>}
          </Card>

          <OutcomeCard causes={causes} c={c} baseCurrency={m.org?.base_currency ?? 'EUR'} canEdit={canEdit} onSave={update} />
          <CaseAdr orgId={orgId} id={id} role={m.role} userId={m.user.id} c={c} body={configuredCountries.find(x=>x.country_code===c.country_code)?.adr_name ?? ''} currency={m.org?.base_currency ?? 'EUR'} onSaved={refresh}/>
          <CaseLetters letters={letters} loading={lettersResult.isPending} error={lettersResult.isError} anonymised={Boolean(c.anonymised_at)} members={members} reference={c.reference ?? ''} firm={m.org?.legal_name ?? ''} address={m.org?.firm_address} expanded={expandedLetters} onToggle={toggleLetter} revealId={revealLetter} onGenerate={canEdit ? () => setLetterOpen(true) : undefined} />

          <Card title="Internal notes and attachments">
            <p className="mb-2 text-xs text-muted-foreground">Never shown to the customer.</p>
            {canEdit && (
              <div className="space-y-2">
                <Textarea aria-label="Internal note" rows={3} placeholder="Add an internal note" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-primary hover:underline">
                    <Paperclip aria-hidden="true" className="h-4 w-4" /> Attach file
                    <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
                  </label>
                  <Button size="sm" onClick={addNote} disabled={!note.trim()}>Add note</Button>
                </div>
              </div>
            )}
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

          <Card title="Timeline">
            <ol className="space-y-4">
              {events.map((e) => (
                <li key={e.id} className="border-l-2 pl-3 text-sm">
                  <EventLine e={e} nameOf={nameOf} onOpen={openAttachment} letterId={matchLetterEvent(e, letters)} onLetter={showLetter} />
                  <p className="mt-0.5 text-xs text-muted-foreground tabular">{nameOf(e.actor)} · {new Date(e.created_at).toLocaleString("en-GB")}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {nextOpen && <Dialog open onOpenChange={setNextOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Next step</DialogTitle></DialogHeader>{nextStatuses(status,m.role,m.org?.qa_required ?? false,canEdit).map(next=>{const requirement=transitionRequirement(next,status,letters,c.holding_reason);return <div key={next} className="space-y-1"><Button className="w-full whitespace-normal" variant="outline" disabled={transitionBusy || (next!=='closed' && (!!requirement || lettersResult.isPending || lettersResult.isError))} onClick={async()=>{if(next==='closed'){setNextOpen(false);setCloseOpen(true);return;}setTransitionBusy(true);try{if(await update({status:next}))setNextOpen(false);}finally{setTransitionBusy(false);}}}>{STATUSES[next]}</Button>{requirement && <p className="text-sm text-muted-foreground">{requirement}</p>}</div>;})}</DialogContent></Dialog>}
      {closeOpen && <CloseChecklistDialog causes={causes} c={c} finalSent={['final_response_sent','escalated_to_adr'].includes(status) && letters.some(l=>l.kind.startsWith('final_') && l.status==='sent')} baseCurrency={m.org?.base_currency ?? 'EUR'} onClose={()=>setCloseOpen(false)} onSave={update}/>}
      {letterOpen && <LetterDialog c={c} onClose={() => setLetterOpen(false)} onSent={refresh} />}
    </div>
  );
}

type Ev = { kind: string; detail: unknown };
function EventLine({ e, nameOf, onOpen, letterId, onLetter }: { e: Ev; nameOf: (u: string | null) => string; onOpen: (p: string) => void; letterId?: string | undefined; onLetter: (id: string) => void }) {
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
    case "letter_sent": return <p>{letterId ? <a href={`#letter-${letterId}`} className="text-primary hover:underline" onClick={event => { event.preventDefault(); onLetter(letterId); }}>Letter sent: <strong>{TEMPLATE_KINDS[d.template as TemplateKind]}</strong></a> : <>Letter sent: <strong>{TEMPLATE_KINDS[d.template as TemplateKind]}</strong></>}</p>;
    case "note": return <p className="whitespace-pre-wrap rounded bg-muted px-2 py-1">{d.text}</p>;
    case "attachment": return <p>Attachment: <button className="text-primary hover:underline" onClick={() => onOpen(d.path!)}>{d.name}</button></p>;
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
  const [kind, setKind] = useState<TemplateKind>(c.status === "received" ? "acknowledgement" : "holding");
  const [lang, setLang] = useState<string>(c.language ?? "en");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const adr = countries.find((x) => x.country_code === c.country_code);
  const agent = members.find((x) => x.user_id === (c.assigned_to ?? m.user.id));
  const {data:causes=[]}=useQuery(rootCausesQuery(orgId));

  const key = `${kind}:${lang}`;
  if (loadedKey !== key) {
    const t = templates.find((x) => x.kind === kind && x.language === lang) ?? templates.find((x) => x.kind === kind && x.language === "en");
    const values = caseMergeValues(c, { firm: m.org?.legal_name ?? '', address: m.org?.firm_address, firmEmail:m.org?.complaints_email, agent: agent?.name, agentEmail:agent?.email, adrName: adr?.adr_name, adrContact: [adr?.adr_contact, adr?.adr_website].filter(Boolean).join(', '), language:lang, extended:kind==='holding', rootCause:causes.find(x=>x.id===c.root_cause_id)?.name??c.root_cause_category??'' });
    setSubject(mergeTemplate(t?.subject ?? "", values));
    setBody(mergeTemplate(t?.body ?? "", values));
    setLoadedKey(key);
  }
  const tpl = templates.find((x) => x.kind === kind && x.language === lang);
  const adrMissing = isFinal(kind) && tpl && !hasAdrBlock(tpl.body);

  const finalBlocked = isFinal(kind) && !["acknowledged","under_investigation","holding_response_sent","reopened"].includes(c.status);
  const draft = isFinal(kind) && m.org?.qa_required;
  async function markSent() {
    if(finalBlocked)return;
    if (kind === "holding" && !reason.trim()) { toast.error("Record the reason for the delay."); return; }
    const { error } = await supabase.from("letters").insert({ org_id: orgId, complaint_id: c.id, kind, language: lang, subject, body, sent_by: m.user.id });
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
      letterPdf({ firm: m.org.legal_name, address: m.org.firm_address, date: new Date().toLocaleDateString('en-GB'), subject, body }, font).save(`${c.reference}-${kind}.pdf`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not generate PDF.'); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col">
        <DialogHeader><DialogTitle>Generate letter</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={kind} onValueChange={(v) => setKind(v as TemplateKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TEMPLATE_KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger aria-label="Letter language"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(LANGUAGES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!tpl && <p className="text-sm text-warning">No {LANGUAGES[lang as keyof typeof LANGUAGES]} version of this template yet. Showing English.</p>}
          {draft && <p className="text-sm text-warning">Draft — pending QA</p>}
          {finalBlocked && <p className="text-sm text-warning">A final response cannot be re-sent while awaiting QA or after it has been sent.</p>}
          {adrMissing && <p className="text-sm text-warning">This final response template has no ADR referral block.</p>}
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
