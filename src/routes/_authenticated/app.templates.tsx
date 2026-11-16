import { EmptyState } from '@/components/empty-state';
import { FileText } from 'lucide-react';
import { createFileRoute, useBlocker } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { membershipQuery, useMembership } from "@/lib/org";
import { LANGUAGES, countriesQuery, membersQuery } from "@/lib/complaints";
import { MERGE_GROUPS, MERGE_LABELS, SAMPLE_VALUES, caseMergeValues, mergeTemplate, unknownPlaceholders, insertAtCursor, type MergeValues, TEMPLATE_KINDS, hasAdrBlock, isFinal, type TemplateKind } from "@/lib/letters";
import { rootCausesQuery, rootCauseLabel } from '@/lib/root-causes';
import { loadPdfFont } from '@/lib/pdf-font';
import { lineDiff, restoreTemplate, templateVersionsQuery } from '@/lib/template-versions';
import { cn } from "@/lib/utils";

export const templatesQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["templates", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("templates").select("*").eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
  });

export const Route = createFileRoute("/_authenticated/app/templates")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(templatesQuery(m?.org?.id ?? ""));
  },
  head: () => ({ meta: [{ title: "Templates — Redress" }, { name: "description", content: "Manage complaint response templates and language versions." }, { property: "og:title", content: "Templates — Redress" }, { property: "og:description", content: "Manage complaint response templates and language versions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Templates,
});

function Templates() {
  const m = useMembership();
  const orgId = m?.org?.id ?? "";
  const { data } = useSuspenseQuery(templatesQuery(orgId));
  const qc = useQueryClient();
  const canEdit = m?.role === "org_admin" || m?.role === "complaints_manager";
  const [kind, setKind] = useState<TemplateKind>("acknowledgement");
  const [lang, setLang] = useState<string>("en");
  const current = data.find((t) => t.kind === kind && t.language === lang);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [baseline, setBaseline] = useState({subject:'',body:''});
  const [restoredFrom,setRestoredFrom] = useState<string|null>(null);
  const [versionId,setVersionId] = useState('');
  const [busy,setBusy] = useState(false);
  const [fieldSearch,setFieldSearch] = useState('');
  const [caseSearch,setCaseSearch] = useState('');
  const [debounced,setDebounced] = useState('');
  const [previewCase,setPreviewCase] = useState<Parameters<typeof caseMergeValues>[0] & {assigned_to?:string|null;root_cause_id?:string|null} | null>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const target = useRef<'subject'|'body'>('body');
  const dirty = restoredFrom !== null || subject !== baseline.subject || body !== baseline.body;
  useBlocker({ shouldBlockFn: () => dirty && !window.confirm('Discard unsaved template changes?'), enableBeforeUnload: dirty });
  useEffect(() => { const next={subject:current?.subject??'',body:current?.body??''}; setSubject(next.subject);setBody(next.body);setBaseline(next);setRestoredFrom(null);setVersionId(''); }, [current?.id, kind, lang]);
  useEffect(() => {const timer=setTimeout(()=>setDebounced(caseSearch.trim()),250);return()=>clearTimeout(timer);},[caseSearch]);
  const {data:countries=[]}=useQuery(countriesQuery(orgId));
  const {data:members=[]}=useQuery(membersQuery(orgId));
  const {data:causes=[]}=useQuery(rootCausesQuery(orgId));
  const {data:versions=[],isError:versionsError}=useQuery(templateVersionsQuery(orgId,current?.id??''));
  const selectedVersion=versions.find(v=>v.id===versionId);
  const {data:matches=[],isError:searchError}=useQuery({queryKey:['template-preview-search',orgId,debounced],enabled:debounced.length>=3,queryFn:async()=>{
    const term=debounced.replace(/[\\%_]/g,'\\$&');
    const {data,error}=await supabase.from('complaint_queue').select('*').eq('org_id',orgId).is('anonymised_at',null).ilike('reference',`%${term}%`).limit(8);
    if(error)throw error;return data;
  }});
  const unknown=unknownPlaceholders(subject+'\n'+body);
  const missingAdr=isFinal(kind)&&!hasAdrBlock(body);
  const valid=unknown.length===0&&!missingAdr;
  async function save() {
    if(!canEdit||!valid||busy)return;
    setBusy(true);
    try {
      const {error}=await supabase.from('templates').upsert({org_id:orgId,kind,language:lang,subject,body,restored_from:restoredFrom,updated_at:new Date().toISOString()},{onConflict:'org_id,kind,language'});
      if(error)throw error;
      setBaseline({subject,body});setRestoredFrom(null);
      await qc.invalidateQueries({queryKey:['templates',orgId]});await qc.invalidateQueries({queryKey:['template-versions',orgId]});toast.success('Template saved.');
    }catch {toast.error('Could not save the template. Your changes are still here.');}finally{setBusy(false);}
  }
  function changeTemplate(next:()=>void) {if(!dirty||window.confirm('Discard unsaved template changes?'))next();}
  function insert(field:keyof MergeValues) {
    const control=target.current==='subject'?subjectRef.current:bodyRef.current;
    const text=target.current==='subject'?subject:body;
    const result=insertAtCursor(text,field,control?.selectionStart??text.length,control?.selectionEnd??text.length);
    if(target.current==='subject')setSubject(result.text);else setBody(result.text);
    requestAnimationFrame(()=>{control?.focus();control?.setSelectionRange(result.cursor,result.cursor);});
  }
  const adr=countries.find(x=>x.country_code===previewCase?.country_code);
  const agent=members.find(x=>x.user_id===(previewCase?.assigned_to??m?.user.id));
  const orgValues={firm_name:m?.org?.legal_name||SAMPLE_VALUES.firm_name||'',firm_address:m?.org?.firm_address||SAMPLE_VALUES.firm_address||'',firm_complaints_email:m?.org?.complaints_email||SAMPLE_VALUES.firm_complaints_email||''};
  const values=previewCase?caseMergeValues(previewCase,{firm:m?.org?.legal_name??'',address:m?.org?.firm_address,firmEmail:m?.org?.complaints_email,agent:agent?.name,agentEmail:agent?.email,adrName:adr?.adr_name,adrContact:[adr?.adr_contact,adr?.adr_website].filter(Boolean).join(', '),language:lang,extended:kind==='holding',rootCause:previewCase.root_cause_id||previewCase.root_cause_category?rootCauseLabel(previewCase.root_cause_id,previewCase.root_cause_category,causes,false):''}):{...SAMPLE_VALUES,...orgValues};
  const renderedSubject=mergeTemplate(subject,values),renderedBody=mergeTemplate(body,values);
  async function pdf() {try {const {letterPdf}=await import('@/lib/letter-pdf');letterPdf({firm:values.firm_name??'',address:values.firm_address??null,date:values.date_of_letter??'',subject:renderedSubject,body:renderedBody},await loadPdfFont()).save('template-preview.pdf');}catch{toast.error('Could not generate the preview PDF.');}}

  return (
    <div className="mx-auto max-w-7xl" onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();}}}>
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">{canEdit ? "Letter and email templates, one version per language." : "Read-only. Ask a Complaints Manager to change templates."}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="space-y-1">
          {(Object.keys(TEMPLATE_KINDS) as TemplateKind[]).map((k) => (
            <Button variant="ghost" key={k} onClick={() => changeTemplate(()=>setKind(k))}
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted", k === kind && "bg-accent text-accent-foreground font-medium")}>
              {TEMPLATE_KINDS[k]}
            </Button>
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1">
            {Object.entries(LANGUAGES).map(([code, name]) => {
              const filled = data.some((t) => t.kind === kind && t.language === code && t.body.trim());
              return (
                <Button key={code} size="sm" variant={code === lang ? "default" : "outline"} onClick={() => changeTemplate(()=>setLang(code))}>
                  {name}{!filled && <span className="ml-1 opacity-60">(empty)</span>}
                </Button>
              );
            })}
          </div>
          {!current && <EmptyState icon={FileText} title="No template for this kind and language" description={`${TEMPLATE_KINDS[kind]} · ${LANGUAGES[lang as keyof typeof LANGUAGES] ?? lang}`} />}
          {missingAdr && (
            <div className="mt-4 flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-warning" />
              Final responses must include the ADR referral block with {"{adr_body_name}"} and {"{adr_body_contact}"}.
            </div>
          )}
          <div className="mt-5 grid min-w-0 gap-6 xl:grid-cols-2"><section className="min-w-0"><div className="space-y-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input id="template-subject" ref={subjectRef} onFocus={()=>{target.current='subject';}} aria-invalid={unknown.length>0} value={subject} disabled={!canEdit} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="template-body">Body</Label>
            <Textarea id="template-body" ref={bodyRef} onFocus={()=>{target.current='body';}} aria-invalid={unknown.length>0} rows={16} className="font-mono text-sm" value={body} disabled={!canEdit} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{subject.length+body.length} characters · {body.split('\n').length} lines{dirty?' · Unsaved changes':''}</p>
          {unknown.length>0&&<p role="alert" className="mt-3 text-sm text-destructive">Unknown fields: {unknown.map(f=>`{${f}}`).join(', ')}. Correct these before saving.</p>}
          {canEdit&&<div className="mt-4"><Button disabled={!valid||busy} onClick={save}>{busy?'Saving…':'Save template'}</Button></div>}
          <aside className="mt-6 border-t pt-4"><Label htmlFor="merge-search">Merge fields</Label><Input id="merge-search" placeholder="Search fields…" value={fieldSearch} onChange={e=>setFieldSearch(e.target.value)}/>
          {Object.entries(MERGE_GROUPS).map(([group,fields])=>{const visible=fields.filter(f=>(MERGE_LABELS[f]+' '+f).toLowerCase().includes(fieldSearch.toLowerCase()));return visible.length?<div key={group} className="mt-4"><h3 className="text-sm font-semibold">{group}</h3>{visible.map(f=><Button key={f} variant="ghost" disabled={!canEdit} onClick={()=>insert(f)} className="h-auto w-full justify-start whitespace-normal py-2 text-left"><span className="min-w-0"><span className="block">{MERGE_LABELS[f]}</span><span className="block break-all text-xs text-muted-foreground">{`{${f}}`} · {SAMPLE_VALUES[f]}</span></span></Button>)}</div>:null;})}</aside>
          <section className="mt-6 border-t pt-4" aria-labelledby="version-history"><h2 id="version-history" className="font-semibold">Version history</h2>
          {versionsError&&<p className="mt-2 text-sm text-muted-foreground">Version history is unavailable.</p>}
          {!current&&<p className="mt-2 text-sm text-muted-foreground">Save this template to start its history.</p>}
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">{versions.map(v=><Button key={v.id} variant={v.id===versionId?'secondary':'ghost'} aria-pressed={v.id===versionId} className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setVersionId(v.id)}>{new Date(v.saved_at).toLocaleString('en-GB')} · {members.find(x=>x.user_id===v.saved_by)?.name??'System'}{v.restored_from?' · Restored':''}</Button>)}</div>
          {selectedVersion&&<div className="mt-3"><p className="text-sm text-muted-foreground">Selected version compared with current editor text.</p><pre className="mt-2 max-h-72 overflow-auto border bg-muted p-3 text-xs" aria-label="Line differences">{lineDiff(selectedVersion.subject+'\n'+selectedVersion.body,subject+'\n'+body).map((line,index)=><div key={index} className={line.kind==='added'?'bg-success/15':line.kind==='removed'?'bg-destructive/15':''}><span className="font-semibold">{line.kind==='added'?'+ Added: ':line.kind==='removed'?'− Removed: ':'  '}</span>{line.text}</div>)}</pre>{canEdit&&<Button className="mt-2" variant="outline" onClick={()=>{const next=restoreTemplate(selectedVersion);setSubject(next.subject);setBody(next.body);setRestoredFrom(next.restored_from);toast.info('Version loaded. Save to restore it.');}}>Restore this version</Button>}</div>}
          </section>
          </section><section className="min-w-0"><h2 className="font-semibold">Live preview</h2><Label htmlFor="preview-case" className="mt-3 block">Preview with case…</Label><Input id="preview-case" placeholder="Search case reference…" value={caseSearch} onChange={e=>setCaseSearch(e.target.value)}/>
          {searchError&&<p role="status" className="mt-2 text-sm text-muted-foreground">Case search is unavailable.</p>}
          {debounced.length>=3&&!matches.length&&!searchError&&<p className="mt-2 text-sm text-muted-foreground">No matching cases.</p>}
          {matches.map(c=><Button variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" key={c.id} onClick={async()=>{const {data,error}=await supabase.from('complaints').select('root_cause_id').eq('org_id',orgId).eq('id',c.id??'').single();if(error){toast.error('Could not load this case.');return;}setPreviewCase({...c,...data});setCaseSearch('');}}>{c.reference} · {c.complainant_name}</Button>)}
          <div className="my-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setPreviewCase(null)}>Sample values</Button><Button size="sm" variant="outline" onClick={pdf}>Preview PDF</Button></div>
          <p className="mb-2 text-xs text-muted-foreground">{previewCase?previewCase.reference:'Fictional sample'} · Preview only</p>
          <article className="min-w-0 border bg-card p-5 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{values.firm_name}</strong><span>{values.date_of_letter}</span></div><p className="mt-1 whitespace-pre-wrap break-words">{values.firm_address}</p><h3 className="my-6 whitespace-pre-wrap break-words font-semibold">{renderedSubject}</h3><p className="whitespace-pre-wrap break-words">{renderedBody}</p></article>
          </section></div>
        </div>
      </div>
    </div>
  );
}
