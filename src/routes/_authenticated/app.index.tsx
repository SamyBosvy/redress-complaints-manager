import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMembership } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Queue — Redress" }] }),
  component: Queue,
});

function Queue() {
  const m = useMembership();
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold">Queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">{m?.org?.legal_name}</p>
      <Tabs defaultValue="mine" className="mt-6">
        <TabsList>
          <TabsTrigger value="mine">My complaints</TabsTrigger>
          <TabsTrigger value="team">Team queue</TabsTrigger>
          <TabsTrigger value="risk">At risk</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-6 rounded-lg border bg-card p-12 text-center">
        <p className="font-medium">No complaints yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">Logged complaints will appear here with their deadline clocks.</p>
      </div>
    </div>
  );
}
