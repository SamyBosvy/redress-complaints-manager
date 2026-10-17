import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { membershipQuery, useMembership } from "@/lib/org";
import { membersQuery } from "@/lib/complaints";
import { downloadFile, toCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/app/audit")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(membersQuery(m!.org!.id));
  },
  head: () => ({ meta: [{ title: "Audit log — Redress" }, { name: "description", content: "Review the immutable audit history for your firm." }, { property: "og:title", content: "Audit log — Redress" }, { property: "og:description", content: "Review the immutable audit history for your firm." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Audit,
});

const TABLES: Record<string, string> = {
  complaints: "Complaints", complaint_events: "Notes and attachments", letters: "Letters", templates: "Templates",
  organisations: "Organisation", org_members: "Users and roles", org_countries: "Countries and ADR bodies",
  holidays: "Calendars", rule_sets: "Rule sets", rule_set_assignments: "Rule set assignments",
};
const ALL = "__all";
const SKIP = new Set(["updated_at"]);

function changed(before: any, after: any) {
  if (!before || !after) return [];
  return Object.keys(after).filter((k) => !SKIP.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}

function Audit() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const nameOf = (u: string | null) => (u ? members.find((x) => x.user_id === u)?.name ?? u : "System");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ table: ALL, action: ALL, actor: ALL, from: monthAgo, to: today });
  const allowed = m.role === "org_admin" || m.role === "complaints_manager" || m.role === "read_only";

  const { data = [], isLoading } = useQuery({
    queryKey: ["audit", orgId, f],
    enabled: allowed,
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").eq("org_id", orgId)
        .gte("created_at", f.from + "T00:00:00Z").lte("created_at", f.to + "T23:59:59Z")
        .order("created_at", { ascending: false }).limit(2000);
      if (f.table !== ALL) q = q.eq("table_name", f.table);
      if (f.action !== ALL) q = q.eq("action", f.action);
      if (f.actor !== ALL) q = q.eq("actor", f.actor);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  if (!allowed) return <p className="text-muted-foreground">You do not have access to the audit log.</p>;

  function exportCsv() {
    const rows = [["Timestamp (UTC)", "User", "Area", "Action", "Record", "Fields changed", "Before", "After"]];
    for (const r of data) rows.push([
      r.created_at, nameOf(r.actor), TABLES[r.table_name] ?? r.table_name, r.action, r.row_id ?? "",
      changed(r.before, r.after).join("; "), r.before ? JSON.stringify(r.before) : "", r.after ? JSON.stringify(r.after) : "",
    ]);
    downloadFile(`audit-log-${f.from}-to-${f.to}.csv`, toCsv(rows));
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every action is recorded permanently. Entries cannot be edited or deleted.</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data.length}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Pick label="Area" value={f.table} onChange={(v) => setF({ ...f, table: v })} options={TABLES} />
        <Pick label="Action" value={f.action} onChange={(v) => setF({ ...f, action: v })} options={{ insert: "Created", update: "Changed", delete: "Deleted" }} />
        <Pick label="User" value={f.actor} onChange={(v) => setF({ ...f, actor: v })} options={Object.fromEntries(members.map((x) => [x.user_id, x.name]))} />
        <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" className="tabular" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" className="tabular" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 font-medium">Area</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const ch = changed(r.before, r.after);
              const a = r.after as any, b = r.before as any;
              return (
                <tr key={r.id} className="border-b align-top last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 tabular text-xs">{new Date(r.created_at).toLocaleString("en-GB")}</td>
                  <td className="px-4 py-3">{nameOf(r.actor)}</td>
                  <td className="px-4 py-3">{TABLES[r.table_name] ?? r.table_name}</td>
                  <td className="px-4 py-3 capitalize">{r.action === "insert" ? "Created" : r.action === "update" ? "Changed" : "Deleted"}</td>
                  <td className="px-4 py-3 text-xs">
                    {(a?.reference || b?.reference) && <span className="mr-2 font-mono">{a?.reference ?? b?.reference}</span>}
                    {r.action === "update" ? (
                      <ul className="space-y-0.5">
                        {ch.slice(0, 6).map((k) => (
                          <li key={k}><span className="text-muted-foreground">{k}:</span> {fmt(b?.[k])} → <strong>{fmt(a?.[k])}</strong></li>
                        ))}
                        {ch.length > 6 && <li className="text-muted-foreground">+{ch.length - 6} more (see CSV)</li>}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!isLoading && data.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No entries for these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {data.length === 2000 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 2,000 entries. Narrow the date range to see more.</p>}
    </div>
  );
}

function fmt(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

function Pick({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
