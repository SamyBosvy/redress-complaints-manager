import { EmptyState } from '@/components/empty-state';
import { FileText } from 'lucide-react';
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { membershipQuery, useMembership } from "@/lib/org";
import { LANGUAGES } from "@/lib/complaints";
import { MERGE_FIELDS, TEMPLATE_KINDS, hasAdrBlock, isFinal, type TemplateKind } from "@/lib/letters";
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
    await context.queryClient.ensureQueryData(templatesQuery(m!.org!.id));
  },
  head: () => ({ meta: [{ title: "Templates — Redress" }, { name: "description", content: "Manage complaint response templates and language versions." }, { property: "og:title", content: "Templates — Redress" }, { property: "og:description", content: "Manage complaint response templates and language versions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Templates,
});

function Templates() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data } = useSuspenseQuery(templatesQuery(orgId));
  const qc = useQueryClient();
  const canEdit = m.role === "org_admin" || m.role === "complaints_manager";
  const [kind, setKind] = useState<TemplateKind>("acknowledgement");
  const [lang, setLang] = useState<string>("en");
  const current = data.find((t) => t.kind === kind && t.language === lang);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  useEffect(() => { setSubject(current?.subject ?? ""); setBody(current?.body ?? ""); }, [current?.id, kind, lang]);

  async function save() {
    const { error } = await supabase.from("templates").upsert(
      { org_id: orgId, kind, language: lang, subject, body, updated_at: new Date().toISOString() },
      { onConflict: "org_id,kind,language" },
    );
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["templates", orgId] });
    toast.success("Template saved.");
  }

  const missingAdr = isFinal(kind) && body.trim() !== "" && !hasAdrBlock(body);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">{canEdit ? "Letter and email templates, one version per language." : "Read-only. Ask a Complaints Manager to change templates."}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-1">
          {(Object.keys(TEMPLATE_KINDS) as TemplateKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={cn("block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted", k === kind && "bg-accent text-accent-foreground font-medium")}>
              {TEMPLATE_KINDS[k]}
            </button>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap gap-1">
            {Object.entries(LANGUAGES).map(([code, name]) => {
              const filled = data.some((t) => t.kind === kind && t.language === code && t.body.trim());
              return (
                <Button key={code} size="sm" variant={code === lang ? "default" : "outline"} onClick={() => setLang(code)}>
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
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="template-subject">Subject</Label>
            <Input id="template-subject" value={subject} disabled={!canEdit} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="template-body">Body</Label>
            <Textarea id="template-body" rows={16} className="font-mono text-sm" value={body} disabled={!canEdit} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Merge fields: {MERGE_FIELDS.map((f) => `{${f}}`).join("  ")}
          </p>
          {canEdit && <div className="mt-4 flex justify-end"><Button onClick={save}>Save template</Button></div>}
        </div>
      </div>
    </div>
  );
}
