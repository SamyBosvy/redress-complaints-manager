import { AccessibleField } from '@/components/accessible-field';
import { createFileRoute, redirect, useNavigate, useBlocker } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { holidayNote } from "@/lib/public-holidays";
import { toast } from "sonner";
import { Plus, Trash2, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/org";
import { securityDestination } from '@/lib/workspace-access';
import { COUNTRIES, LICENCE_LABELS } from "@/lib/countries";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { WIZARD_STEPS, EU_COUNTRIES, EEA_COUNTRIES, searchCountries, searchText, defaultTimeZone, timeZones, ADR_MEMBERS_URL, copyAdr, validAdr, saveWizardDraft, readWizardDraft, clearWizardDraft, wizardProgress, type WizardDraft } from '@/lib/setup-wizard';
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/setup")({
  beforeLoad: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    const destination = securityDestination(m);
    if (destination) throw redirect({to: destination});
    if (m?.org?.setup_complete) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: "Set up your organisation — Redress" }, { name: "description", content: "Set up your firm’s countries, calendars and complaint deadlines." }, { property: "og:title", content: "Set up your organisation — Redress" }, { property: "og:description", content: "Set up your firm’s countries, calendars and complaint deadlines." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Setup,
});

type Licence = keyof typeof LICENCE_LABELS;
type Adr = { name: string; website: string; contact: string };
type Holiday = { country: string; date: string; name: string };

const STEPS = WIZARD_STEPS;

function Setup() {
  const m = useMembership();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [entity, setEntity] = useState({
    name: m?.org?.legal_name ?? "",
    licence: (m?.org?.licence_type ?? "payment_institution") as Licence,
    home: m?.org?.home_country ?? "",
    regulator: m?.org?.regulator ?? "",
    timeZone: m?.org?.time_zone ?? defaultTimeZone(m?.org?.home_country ?? ''),
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [adr, setAdr] = useState<Record<string, Adr>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const loadedHolidayCountries = useRef(new Set<string>());
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [rules, setRules] = useState({ name: "PSD2 payment services", ack: 1, final: 15, extended: 35 });
  const [addLater, setAddLater] = useState<string[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [resumeDraft, setResumeDraft] = useState<WizardDraft|null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const completed = useRef(false);
  const draftOrg = useRef(m?.org?.id ?? 'new');
  const userId = m?.user.id ?? '';
  const [savedValues, setSavedValues] = useState('');
  const values = JSON.stringify({entity,countries,adr,addLater,holidays,rules});
  const dirty = draftReady && !completed.current && values !== savedValues;
  const progress = wizardProgress(step);
  useBlocker({shouldBlockFn:()=>dirty&&!window.confirm('Leave setup with unsaved changes?'),enableBeforeUnload:dirty});

  useEffect(()=>{
    setZones(timeZones());
    if (!userId || (m?.org && m.role !== 'org_admin')) return;
    try { setResumeDraft(readWizardDraft(window.localStorage,userId,draftOrg.current)); } catch { /* Storage may be blocked. */ }
    setSavedValues(values);
    setDraftReady(true);
  },[userId]); // eslint-disable-line react-hooks/exhaustive-deps

  function snapshot(nextStep:number):WizardDraft {
    return {version:1,step:nextStep,entity,countries,adr,addLater,holidays,loadedHolidayCountries:[...loadedHolidayCountries.current],rules};
  }
  function persist(nextStep:number) {
    try { saveWizardDraft(window.localStorage,userId,draftOrg.current,snapshot(nextStep)); } catch { /* Continue without resume. */ }
    setSavedValues(values);
  }
  function resume() {
    if (!resumeDraft) return;
    const d=resumeDraft;
    setStep(d.step);setEntity(d.entity);setCountries(d.countries);setAdr(d.adr);setAddLater(d.addLater);setHolidays(d.holidays);setRules(d.rules);
    loadedHolidayCountries.current=new Set(d.loadedHolidayCountries);
    setSavedValues(JSON.stringify({entity:d.entity,countries:d.countries,adr:d.adr,addLater:d.addLater,holidays:d.holidays,rules:d.rules}));
    setResumeDraft(null);
  }
  function startAgain() {
    try { clearWizardDraft(window.localStorage,userId,draftOrg.current); } catch { /* Continue without storage. */ }
    setResumeDraft(null);
  }

  const countryKey = countries.join(",");
  useEffect(() => {
    if (step !== 3) return;
    let live = true;
    const pending = countries.filter((c) => !loadedHolidayCountries.current.has(c));
    if (!pending.length) return;
    setLoadingHolidays(true);
    const years = [new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1];
    void import("@/lib/public-holidays").then(({ publicHolidays }) => Promise.all(pending.flatMap((c) => years.map(async (y) => (await publicHolidays(c, y)).map((h) => ({ country: c, ...h }))))))
      .then((lists) => { if (!live) return; pending.forEach((c) => loadedHolidayCountries.current.add(c)); setHolidays((cur) => { const seen = new Set(cur.map((h) => `${h.country}|${h.date}`)); return [...cur, ...lists.flat().filter((h) => !seen.has(`${h.country}|${h.date}`))]; }); })
      .catch(() => { if (live) toast.error("Couldn't load public holidays. Add them manually."); })
      .finally(() => { if (live) setLoadingHolidays(false); });
    return () => { live = false; setLoadingHolidays(false); };
  }, [step, countryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (m?.org && m.role !== "org_admin") {
    return (
      <Centered>
        <p className="font-medium">Your organisation is still being set up.</p>
        <p className="mt-1 text-sm text-muted-foreground">An Org Admin needs to complete the setup before you can start.</p>
      </Centered>
    );
  }

  function next() {
    if (step === 0 && (!entity.name.trim() || !entity.home)) { toast.error("Legal entity name and home country are required."); return; }
    if (step === 1 && countries.length === 0) { toast.error("Select at least one country."); return; }
    if (step === 2 && countries.some(c=>!addLater.includes(c)&&!validAdr(adr[c]))) { toast.error('Enter an ADR body name and contact details or website for each country, or choose Add later.'); return; }
    if (step === 4 && !(rules.final > 0 && rules.extended >= rules.final)) { toast.error("Extended deadline must be at least the final response deadline."); return; }
    persist(Math.min(step+1,STEPS.length-1));
    if (step < STEPS.length - 1) setStep(step + 1);
    else void finish();
  }

  async function finish() {
    setBusy(true);
    try {
      let orgId = m?.org?.id;
      if (!orgId) {
        const { data, error } = await supabase.rpc("create_organisation", { _legal_name: entity.name.trim() });
        if (error) throw error;
        orgId = data as string;
        // Migrate the anonymous-organisation draft scope as soon as the firm exists.
        try { saveWizardDraft(window.localStorage,userId,orgId,snapshot(step)); clearWizardDraft(window.localStorage,userId,draftOrg.current); } catch { /* Storage is optional. */ }
        draftOrg.current=orgId;
      }
      if (!orgId) throw new Error('Could not identify your organisation.');
      const savedOrgId=orgId;
      const { error: e1 } = await supabase.from("organisations").update({
        legal_name: entity.name.trim(),
        licence_type: entity.licence,
        home_country: entity.home,
        regulator: entity.regulator.trim() || null,
        time_zone: entity.timeZone,
      }).eq("id", orgId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("org_countries").upsert(
        countries.map((c) => ({
          org_id: savedOrgId, country_code: c,
          adr_name: addLater.includes(c) ? null : adr[c]?.name.trim() || null, adr_website: addLater.includes(c) ? null : adr[c]?.website.trim() || null, adr_contact: addLater.includes(c) ? null : adr[c]?.contact.trim() || null,
        })),
        { onConflict: "org_id,country_code" },
      );
      if (e2) throw e2;
      const valid = holidays.filter((h) => h.date && h.name.trim() && countries.includes(h.country));
      if (valid.length) {
        const { error: e3 } = await supabase.from("holidays").upsert(
          valid.map((h) => ({ org_id: savedOrgId, country_code: h.country, holiday_date: h.date, name: h.name.trim() })),
          { onConflict: "org_id,country_code,holiday_date" },
        );
        if (e3) throw e3;
      }
      const { error: e4 } = await supabase.from("rule_sets").update({
        name: rules.name, ack_days: rules.ack, final_days: rules.final, extended_days: rules.extended,
      }).eq("org_id", orgId).eq("is_default", true);
      if (e4) throw e4;
      const { error: e5 } = await supabase.from("organisations").update({ setup_complete: true }).eq("id", orgId);
      if (e5) throw e5;
      completed.current=true;
      try { clearWizardDraft(window.localStorage,userId,draftOrg.current); } catch { /* Setup must not be blocked by storage. */ }
      await qc.invalidateQueries({ queryKey: ["membership"] });
      toast.success("Organisation set up.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save setup");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4"><Logo /></header>
      <Dialog open={resumeDraft!==null} onOpenChange={open=>{if(!open)startAgain();}}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogTitle>Resume setup where you left off?</DialogTitle>
          <DialogDescription>Your saved firm details and setup progress are available on this device.</DialogDescription>
          <div className="flex flex-col gap-2">
            <Button className="min-h-12 w-full" onClick={resume}>Resume</Button>
            <Button variant="outline" className="min-h-12 w-full" onClick={startAgain}>Start again</Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p role="status" className="mb-3 text-sm text-muted-foreground">Step {progress.number} of {progress.total}</p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i===step?'step':undefined} className={i === step ? "font-semibold text-primary" : i < step ? "text-foreground" : "text-muted-foreground"}>
              <span className="tabular">{i + 1}.</span> {s}
            </li>
          ))}
        </ol>
        <h1 className="mt-6 text-2xl font-semibold">{STEPS[step]}</h1>

        <div className="mt-6 min-w-0 space-y-5 border-t pt-6">
          {step === 0 && (
            <>
              <Field label="Legal entity name *">
                <Input value={entity.name} maxLength={200} onChange={(e) => setEntity({ ...entity, name: e.target.value })} />
              </Field>
              <Field label="Licence type *">
                <Select value={entity.licence} onValueChange={(v) => setEntity({ ...entity, licence: v as Licence })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LICENCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Home country *">
                <CountrySelect value={entity.home} onChange={(v) => setEntity({ ...entity, home: v, timeZone: defaultTimeZone(v) })} />
              </Field>
              <Field label="Search time zones">
                <Input type="search" value={zoneSearch} onChange={e=>setZoneSearch(e.target.value)} placeholder="Europe/Paris" />
              </Field>
              <Field label="Firm time zone">
                <Select value={entity.timeZone} onValueChange={v=>setEntity({...entity,timeZone:v})}>
                  <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{[...new Set([entity.timeZone,...zones.filter(z=>searchText(z.replaceAll('_',' ')).includes(searchText(zoneSearch)))])].map(z=><SelectItem key={z} value={z}>{z.replaceAll('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Regulator">
                <Input value={entity.regulator} maxLength={200} placeholder="e.g. Banque de France / ACPR" onChange={(e) => setEntity({ ...entity, regulator: e.target.value })} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">Countries where you serve customers.</p>
              <Field label="Search countries"><Input type="search" value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder="Country name" /></Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={()=>setCountries([...EU_COUNTRIES])}>Select all EU</Button>
                <Button variant="outline" size="sm" onClick={()=>setCountries([...EEA_COUNTRIES])}>Select all EU/EEA</Button>
                <Button variant="ghost" size="sm" onClick={()=>setCountries([])}>Clear</Button>
              </div>
              <ul aria-label="Selected countries" className="flex flex-wrap gap-2">{countries.map(c=><li key={c}><Button variant="secondary" size="sm" aria-label={`Remove ${COUNTRIES[c]}`} onClick={()=>setCountries(countries.filter(x=>x!==c))}>{COUNTRIES[c]}<X aria-hidden="true" className="h-3 w-3 shrink-0" /></Button></li>)}</ul>
              <div className="grid gap-2 sm:grid-cols-3">
                {searchCountries(countrySearch).map(([code, name]) => (
                  <label key={code} className="flex min-w-0 items-center gap-2 text-sm">
                    <Checkbox
                      checked={countries.includes(code)}
                      onCheckedChange={(c) => setCountries(c ? [...countries, code] : countries.filter((x) => x !== code))}
                    />
                    {name}
                  </label>
                ))}
              </div>
              {searchCountries(countrySearch).length===0&&<p role="status" className="text-sm text-muted-foreground">No countries found.</p>}
            </>
          )}

          {step === 2 && countries.map((c) => (
            <div key={c} className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
              <p className="font-medium">{COUNTRIES[c]}</p>
              <a className="inline-flex items-center gap-2 text-sm text-primary underline" href={ADR_MEMBERS_URL} target="_blank" rel="noopener noreferrer">Find the ADR body for this country<ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /><span className="sr-only"> (opens in a new tab)</span></a>
              <Field label={`Copy ADR details for ${COUNTRIES[c]} from another country`}>
                <Select value="" onValueChange={from=>{setAdr(copyAdr(adr,from,c));setAddLater(addLater.filter(x=>x!==c));}}>
                  <SelectTrigger><SelectValue placeholder="Copy from another country" /></SelectTrigger>
                  <SelectContent>{countries.filter(x=>x!==c&&validAdr(adr[x])).map(x=><SelectItem key={x} value={x}>{COUNTRIES[x]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={addLater.includes(c)} onCheckedChange={checked=>setAddLater(checked?[...addLater,c]:addLater.filter(x=>x!==c))} />Add later for {COUNTRIES[c]}</label>
              {(["name", "website", "contact"] as const).map((f) => (
                <Field key={f} label={f === "name" ? "ADR / ombudsman body" : f === "website" ? "Website" : "Contact details"}>
                  <Input
                    value={adr[c]?.[f] ?? ""}
                    disabled={addLater.includes(c)}
                    maxLength={300}
                    onChange={(e) => setAdr({ ...adr, [c]: { name: "", website: "", contact: "", ...adr[c], [f]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          ))}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">Weekends are excluded automatically. Nationwide public holidays for this year and next are pre-filled; check, edit or remove them. You can change them later.</p>
              {countries.map((c) => holidayNote(c) && <p key={c} className="text-sm text-muted-foreground">{COUNTRIES[c]}: {holidayNote(c)}</p>)}
              {holidays.map((h, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
                  <Select value={h.country} onValueChange={(v) => setHolidays(holidays.map((x, j) => j === i ? { ...x, country: v } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c} value={c}>{COUNTRIES[c]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" className="tabular" value={h.date} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  <Input placeholder="Holiday name" maxLength={100} value={h.name} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setHolidays(holidays.filter((_, j) => j !== i))}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setHolidays([...holidays, { country: countries[0] ?? "", date: "", name: "" }])}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Add holiday
              </Button>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-muted-foreground">Pre-filled with the PSD2 default. All values are business days.</p>
              <Field label="Rule set name"><Input value={rules.name} onChange={(e) => setRules({ ...rules, name: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Acknowledgement"><Num value={rules.ack} onChange={(v) => setRules({ ...rules, ack: v })} /></Field>
                <Field label="Final response"><Num value={rules.final} onChange={(v) => setRules({ ...rules, final: v })} /></Field>
                <Field label="Extended (after holding)"><Num value={rules.extended} onChange={(v) => setRules({ ...rules, extended: v })} /></Field>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <Button variant="ghost" disabled={step === 0 || busy} onClick={() => {persist(step-1);setStep(step - 1);}}>Back</Button>
          <Button onClick={next} disabled={busy || loadingHolidays}>{loadingHolidays ? "Loading holidays…" : step === STEPS.length - 1 ? "Finish setup" : "Next"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <AccessibleField label={label}>{children}</AccessibleField>;
}

function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <Input type="number" min={0} max={365} className="tabular" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />;
}

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
      <SelectContent>{Object.entries(COUNTRIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-center"><div>{children}</div></div>;
}
