import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership } from "@/lib/org";
import { COUNTRIES, LICENCE_LABELS } from "@/lib/countries";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/setup")({
  beforeLoad: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (m?.org?.setup_complete) throw redirect({ to: "/app" });
  },
  head: () => ({ meta: [{ title: "Set up your organisation — Redress" }] }),
  component: Setup,
});

type Licence = keyof typeof LICENCE_LABELS;
type Adr = { name: string; website: string; contact: string };
type Holiday = { country: string; date: string; name: string };

const STEPS = ["Legal entity", "Countries", "ADR bodies", "Calendars", "Deadline rules"];

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
  });
  const [countries, setCountries] = useState<string[]>([]);
  const [adr, setAdr] = useState<Record<string, Adr>>({});
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [rules, setRules] = useState({ name: "PSD2 payment services", ack: 1, final: 15, extended: 35 });

  if (m?.org && m.role !== "org_admin") {
    return (
      <Centered>
        <p className="font-medium">Your organisation is still being set up.</p>
        <p className="mt-1 text-sm text-muted-foreground">An Org Admin needs to complete the setup before you can start.</p>
      </Centered>
    );
  }

  function next() {
    if (step === 0 && (!entity.name.trim() || !entity.home)) return toast.error("Legal entity name and home country are required.");
    if (step === 1 && countries.length === 0) return toast.error("Select at least one country.");
    if (step === 4 && !(rules.final > 0 && rules.extended >= rules.final)) return toast.error("Extended deadline must be at least the final response deadline.");
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
      }
      const { error: e1 } = await supabase.from("organisations").update({
        legal_name: entity.name.trim(),
        licence_type: entity.licence,
        home_country: entity.home,
        regulator: entity.regulator.trim() || null,
      }).eq("id", orgId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("org_countries").upsert(
        countries.map((c) => ({
          org_id: orgId!, country_code: c,
          adr_name: adr[c]?.name || null, adr_website: adr[c]?.website || null, adr_contact: adr[c]?.contact || null,
        })),
        { onConflict: "org_id,country_code" },
      );
      if (e2) throw e2;
      const valid = holidays.filter((h) => h.date && h.name.trim() && countries.includes(h.country));
      if (valid.length) {
        const { error: e3 } = await supabase.from("holidays").upsert(
          valid.map((h) => ({ org_id: orgId!, country_code: h.country, holiday_date: h.date, name: h.name.trim() })),
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
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className={i === step ? "font-semibold text-primary" : i < step ? "text-foreground" : "text-muted-foreground"}>
              <span className="tabular">{i + 1}.</span> {s}
            </li>
          ))}
        </ol>
        <h1 className="mt-6 text-2xl font-semibold">{STEPS[step]}</h1>

        <div className="mt-6 space-y-5 rounded-lg border bg-card p-6">
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
                <CountrySelect value={entity.home} onChange={(v) => setEntity({ ...entity, home: v })} />
              </Field>
              <Field label="Regulator">
                <Input value={entity.regulator} maxLength={200} placeholder="e.g. Banque de France / ACPR" onChange={(e) => setEntity({ ...entity, regulator: e.target.value })} />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-muted-foreground">Countries where you serve customers.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(COUNTRIES).map(([code, name]) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={countries.includes(code)}
                      onCheckedChange={(c) => setCountries(c ? [...countries, code] : countries.filter((x) => x !== code))}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 2 && countries.map((c) => (
            <div key={c} className="space-y-3 border-b pb-5 last:border-0 last:pb-0">
              <p className="font-medium">{COUNTRIES[c]}</p>
              {(["name", "website", "contact"] as const).map((f) => (
                <Field key={f} label={f === "name" ? "ADR / ombudsman body" : f === "website" ? "Website" : "Contact details"}>
                  <Input
                    value={adr[c]?.[f] ?? ""}
                    maxLength={300}
                    onChange={(e) => setAdr({ ...adr, [c]: { name: "", website: "", contact: "", ...adr[c], [f]: e.target.value } })}
                  />
                </Field>
              ))}
            </div>
          ))}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">Weekends are excluded automatically. Add public holidays for each country; you can edit them later.</p>
              {holidays.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2">
                  <Select value={h.country} onValueChange={(v) => setHolidays(holidays.map((x, j) => j === i ? { ...x, country: v } : x))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c} value={c}>{COUNTRIES[c]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" className="tabular" value={h.date} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  <Input placeholder="Holiday name" maxLength={100} value={h.name} onChange={(e) => setHolidays(holidays.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setHolidays(holidays.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setHolidays([...holidays, { country: countries[0], date: "", name: "" }])}>
                <Plus className="h-4 w-4" /> Add holiday
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
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          <Button onClick={next} disabled={busy}>{step === STEPS.length - 1 ? "Finish setup" : "Continue"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
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
