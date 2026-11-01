import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getRequestOrigin } from "@/lib/origin.functions";

export const Route = createFileRoute("/")({
  loader: () => getRequestOrigin(),
  head: ({ loaderData: origin }) => {
    const image = `${origin}/og-image.png`;
    return {
      meta: [
        { title: "Redress — Complaints management for payment providers" },
        { name: "description", content: "Handle every customer complaint within PSD2 deadlines, with a full audit trail and regulator-ready reporting." },
        { property: "og:title", content: "Redress — Complaints management for payment providers" },
        { property: "og:description", content: "Handle every customer complaint within PSD2 deadlines, with a full audit trail and regulator-ready reporting." },
        { property: "og:type", content: "website" },
        { property: "og:image", content: image },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Redress — every complaint answered fairly, and on time." },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: Index,
});

const points = [
  ["15 / 35", "PSD2 business-day clocks, per customer country calendar"],
  ["Immutable", "Audit trail of every action, enforced at database level"],
  ["Regulator-ready", "Reporting pack by product, category and outcome"],
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Start free trial</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-28">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">For payment and e-money institutions</p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight text-foreground md:text-6xl">
          Every complaint answered fairly, and on time.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Redress helps complaints teams log, track and resolve customer complaints within regulatory deadlines, with a full audit trail.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Start 14-day free trial</Link></Button>
          <span className="self-center text-sm text-muted-foreground">No card required.</span>
        </div>
        <div className="mt-20 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3">
          {points.map(([k, v]) => (
            <div key={k} className="bg-card p-6">
              <div className="font-display text-2xl font-semibold text-foreground tabular">{k}</div>
              <p className="mt-2 text-sm text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-5 border-t px-6 py-6 text-sm"><Link to="/privacy" className="text-muted-foreground hover:text-primary">Privacy policy</Link><Link to="/dpa" className="text-muted-foreground hover:text-primary">Data processing agreement</Link></footer>
    </div>
  );
}
