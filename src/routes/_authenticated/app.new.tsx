import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { membershipQuery, useMembership } from "@/lib/org";
import { COUNTRIES } from "@/lib/countries";
import { CATEGORIES, CHANNELS, LANGUAGES, PRODUCTS, countriesQuery, membersQuery } from "@/lib/complaints";

export const Route = createFileRoute("/_authenticated/app/new")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await Promise.all([
      context.queryClient.ensureQueryData(countriesQuery(m!.org!.id)),
      context.queryClient.ensureQueryData(membersQuery(m!.org!.id)),
    ]);
  },
  head: () => ({ meta: [{ title: "New complaint — Redress" }, { name: "description", content: "Log a customer complaint for your firm." }, { property: "og:title", content: "New complaint — Redress" }, { property: "og:description", content: "Log a customer complaint for your firm." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: NewComplaint,
});

const schema = z.object({
  received_at: z.string().min(1, "Date received is required"),
  channel: z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS]),
  country_code: z.string().min(2, "Country is required"),
  language: z.string(),
  complainant_name: z.string().trim().min(1, "Customer name is required").max(200),
  complainant_email: z.string().trim().email("Invalid email").max(255).or(z.literal("")),
  complainant_phone: z.string().trim().max(50),
  customer_ref: z.string().trim().max(100),
  vulnerable: z.boolean(),
  vulnerable_note: z.string().trim().max(1000),
  product: z.enum(Object.keys(PRODUCTS) as [keyof typeof PRODUCTS]),
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES]),
  summary: z.string().trim().min(1, "Summary is required").max(10000),
  desired_outcome: z.string().trim().max(5000),
  assigned_to: z.string(),
  priority: z.enum(["standard", "high"]),
});

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function NewComplaint() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data: countries } = useSuspenseQuery(countriesQuery(orgId));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({
    received_at: nowLocal(), channel: "", country_code: countries.length === 1 ? countries[0]!.country_code : "",
    language: "en", complainant_name: "", complainant_email: "", complainant_phone: "", customer_ref: "",
    vulnerable: false, vulnerable_note: "", product: "", category: "", summary: "", desired_outcome: "",
    assigned_to: m.role === "agent" ? m.user.id : "none", priority: "standard",
  });
  const set = (k: keyof typeof v) => (val: string | boolean) => setV((p) => ({ ...p, [k]: val }));

  if (m.role === "read_only") return <p className="text-muted-foreground">Read-only users cannot log complaints.</p>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse(v);
    if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check the form"); return; }
    setBusy(true);
    const d = p.data;
    const { data, error } = await supabase.from("complaints").insert({
      org_id: orgId,
      received_at: new Date(d.received_at).toISOString(),
      channel: d.channel, country_code: d.country_code, language: d.language,
      complainant_name: d.complainant_name, complainant_email: d.complainant_email || null,
      complainant_phone: d.complainant_phone || null, customer_ref: d.customer_ref || null,
      vulnerable: d.vulnerable, vulnerable_note: d.vulnerable ? d.vulnerable_note || null : null,
      product: d.product, category: d.category, summary: d.summary, desired_outcome: d.desired_outcome || null,
      assigned_to: d.assigned_to === "none" ? null : d.assigned_to, priority: d.priority,
    }).select("reference").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["queue"] });
    toast.success(`Complaint ${data.reference} logged.`);
    navigate({ to: "/app" });
  }

  const countryOpts = countries.length ? Object.fromEntries(countries.map((c) => [c.country_code, COUNTRIES[c.country_code] ?? c.country_code])) : COUNTRIES;

  return (
    <form onSubmit={submit} className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold">New complaint</h1>
      <p className="mt-1 text-sm text-muted-foreground">Fields marked * are required. The reference and deadlines are set automatically.</p>

      <Section title="Receipt">
        <F label="Date and time received *"><Input type="datetime-local" className="tabular" value={v.received_at} onChange={(e) => set("received_at")(e.target.value)} /></F>
        <F label="Channel *"><Pick value={v.channel} onChange={set("channel")} options={CHANNELS} /></F>
        <F label="Customer country *"><Pick value={v.country_code} onChange={set("country_code")} options={countryOpts} /></F>
        <F label="Language"><Pick value={v.language} onChange={set("language")} options={LANGUAGES} /></F>
      </Section>

      <Section title="Complainant">
        <F label="Name *"><Input value={v.complainant_name} onChange={(e) => set("complainant_name")(e.target.value)} /></F>
        <F label="Customer / account ID"><Input value={v.customer_ref} onChange={(e) => set("customer_ref")(e.target.value)} /></F>
        <F label="Email"><Input type="email" value={v.complainant_email} onChange={(e) => set("complainant_email")(e.target.value)} /></F>
        <F label="Phone"><Input value={v.complainant_phone} onChange={(e) => set("complainant_phone")(e.target.value)} /></F>
        <div className="sm:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={v.vulnerable} onCheckedChange={(c) => set("vulnerable")(!!c)} /> Vulnerable customer
          </label>
          {v.vulnerable && <Input placeholder="Note (optional)" value={v.vulnerable_note} onChange={(e) => set("vulnerable_note")(e.target.value)} />}
        </div>
      </Section>

      <Section title="Complaint">
        <F label="Product *"><Pick value={v.product} onChange={set("product")} options={PRODUCTS} /></F>
        <F label="Category *"><Pick value={v.category} onChange={set("category")} options={CATEGORIES} /></F>
        <div className="sm:col-span-2"><F label="Summary *"><Textarea rows={4} value={v.summary} onChange={(e) => set("summary")(e.target.value)} /></F></div>
        <div className="sm:col-span-2"><F label="Outcome the customer wants"><Textarea rows={2} value={v.desired_outcome} onChange={(e) => set("desired_outcome")(e.target.value)} /></F></div>
      </Section>

      <Section title="Handling">
        <F label="Assigned agent">
          <Pick value={v.assigned_to} onChange={set("assigned_to")} options={{ none: "Unassigned", ...Object.fromEntries(members.map((x) => [x.user_id, x.name])) }} />
        </F>
        <F label="Priority"><Pick value={v.priority} onChange={set("priority")} options={{ standard: "Standard", high: "High" }} /></F>
      </Section>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/app" })}>Cancel</Button>
        <Button type="submit" disabled={busy}>Log complaint</Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6 rounded-lg border bg-card p-5">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function Pick({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
      <SelectContent>{Object.entries(options).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}
