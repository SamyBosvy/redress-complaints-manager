import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useState } from "react";
import { ArrowRight, CalendarDays, FileText, ClipboardCheck, History, ChartNoAxesCombined, ShieldCheck, Check, Menu } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { MarketingPreview } from "@/components/marketing-preview";
import { CONTACT_EMAIL } from "@/lib/contact";
import { TRIAL_PLANS } from "@/lib/trial";
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

const demoUrl = `mailto:${CONTACT_EMAIL}?subject=Redress%20demo`;
const sections = ["Features", "Plans", "FAQ"] as const;
const features = [
  { icon: CalendarDays, title: "Deadlines without guesswork", description: "Track deadlines per country using business-day calendars and configurable rule sets." },
  { icon: FileText, title: "Letters that cover the essentials", description: "Generate letters in six languages from templates with ADR referral checks." },
  { icon: ClipboardCheck, title: "A second pair of eyes", description: "Review responses through QA and assess sampled cases with scorecards." },
  { icon: History, title: "A record you can rely on", description: "Keep an immutable audit log of actions, enforced at database level." },
  { icon: ChartNoAxesCombined, title: "Reporting, ready to share", description: "Export regulatory reporting packs as CSV and PDF with payments separated by currency." },
  { icon: ShieldCheck, title: "Privacy throughout the lifecycle", description: "Manage retention, legal holds and subject-access exports from your workspace." },
];
const faqs = [
  ["Which regulations does it support?", "Redress includes PSD2 15-business-day final-response deadlines and 35-business-day extended deadlines after a holding response. Rule sets are configurable to fit your obligations."],
  ["Can we set our own deadlines?", "Yes. You can configure rule sets and assign them per country and product, using country-specific business-day calendars."],
  ["Which languages are available?", "Letter templates are available in English, French, Spanish, Portuguese, Polish and Dutch (EN, FR, ES, PT, PL, NL)."],
  ["What happens after the trial?", "Nothing is deleted when your trial ends. No plan limits are enforced while billing is paused. Once billing launches, plan limits may apply to exports, custom templates, QA and branding; complaint intake, handling and letters remain available."],
  ["Can customers submit complaints online?", "Yes. Each firm can publish its own public complaint web form and share the link or embed it on its website."],
  ["Can we export our data?", "Yes. Organisation data exports and subject-access exports are available through the privacy tools, alongside CSV and PDF reporting packs."],
];

function TrialLink({ label = "Start 14-day free trial" }: { label?: string }) {
  return <Button asChild size="lg" className="min-h-11 whitespace-normal text-center"><Link to="/auth" search={{ mode: "signup" }}>{label}<ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></Button>;
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Redress home"><Logo className="text-2xl" /></Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            {sections.map(section => <a key={section} href={`#${section.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-primary">{section}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button><TrialLink label="Start free trial" />
          </div>
          <div className="flex items-center gap-1 md:hidden">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Open navigation menu" className="min-h-11 min-w-11"><Menu aria-hidden="true" className="size-5" /></Button></SheetTrigger>
              <SheetContent className="flex w-full max-w-xs flex-col gap-6">
                <SheetTitle>Redress</SheetTitle><SheetDescription className="sr-only">Page navigation and sign-up</SheetDescription>
                <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
                  {sections.map(section => <a key={section} href={`#${section.toLowerCase()}`} onClick={() => setMenuOpen(false)} className="py-3 text-foreground hover:text-primary">{section}</a>)}
                </nav>
                <Button asChild className="min-h-12"><Link to="/auth" search={{ mode: "signup" }} onClick={() => setMenuOpen(false)}>Start free trial</Link></Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <p className="text-sm font-medium text-primary">For payment and e-money institutions</p>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl md:text-6xl">Every complaint answered fairly, and on time.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Redress helps complaints teams log, track and resolve customer complaints within regulatory deadlines, with a full audit trail.</p>
          <div className="mt-8 flex flex-wrap gap-3"><TrialLink /><Button asChild variant="outline" size="lg" className="min-h-11"><a href={demoUrl}>Book a demo</a></Button></div>
          <p className="mt-3 text-sm text-muted-foreground">No card required.</p>
        </section>
        <MarketingPreview />
        <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-16 sm:px-6 md:py-20">
          <p className="text-sm font-medium text-primary">Built for the work</p>
          <h2 id="features-heading" className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-normal md:text-4xl">The details matter. Keep them together.</h2>
          <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => <article key={title} className="border-t pt-5">
              <Icon aria-hidden="true" className="size-6 text-primary" /><h3 className="mt-4 text-lg font-semibold tracking-normal">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>)}
          </div>
        </section>
        <section aria-labelledby="security-heading" className="border-y bg-accent px-4 py-14 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
            <div><p className="text-sm font-medium text-accent-foreground">Security &amp; compliance</p><h2 id="security-heading" className="mt-3 font-display text-3xl font-semibold tracking-normal">Clear access. Lasting accountability.</h2></div>
            <ul className="space-y-4 text-sm">
              {["Role-based access for your team", "Each firm’s data isolated at database level with row-level security", "Append-only audit log", "Optional two-factor sign-in", "Data never deleted when a trial ends"].map(item => <li key={item} className="flex items-start gap-3"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-foreground" /><span>{item}</span></li>)}
            </ul>
          </div>
        </section>
        <section aria-labelledby="founder-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="max-w-3xl"><p className="text-sm font-medium text-primary">From the founder</p><h2 id="founder-heading" className="mt-3 font-display text-3xl font-semibold tracking-normal">Built by someone who handled the complaints.</h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">Redress was built by Samy Bosvy, a former EU/UK Complaints Manager at a global fintech, with a law degree and years of handling payment complaints under PSD2 deadlines across Europe. It's the tool he wished his team had: deadline clocks per country, a full audit trail, and regulator-ready reporting out of the box.</p>
          </div>
        </section>
        <section id="plans" aria-labelledby="plans-heading" className="border-y bg-muted/40 px-4 py-16 sm:px-6 md:py-20">
          <div className="mx-auto max-w-6xl"><h2 id="plans-heading" className="font-display text-3xl font-semibold tracking-normal md:text-4xl">A plan for your team.</h2><p className="mt-3 text-muted-foreground">14-day free trial with all Growth features.</p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {TRIAL_PLANS.map(plan => <article key={plan.name} className="flex min-w-0 flex-col rounded-lg border bg-card p-6">
                <h3 className="font-display text-2xl font-semibold tracking-normal">{plan.name}</h3><p className="mt-2 text-sm font-medium text-primary">Pricing coming soon</p>
                <ul className="my-6 flex-1 space-y-4 text-sm text-muted-foreground">{plan.features.map(feature => <li key={feature} className="flex gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><span>{feature}</span></li>)}</ul>
                <Button asChild variant={plan.name === "Growth" ? "default" : "outline"} className="min-h-11"><a href={demoUrl}>Book a demo</a></Button>
              </article>)}
            </div>
            <p className="mt-5 text-sm text-muted-foreground">Plan limits will apply once billing launches. No limits are enforced while billing is paused.</p>
          </div>
        </section>
        <section id="faq" aria-labelledby="faq-heading" className="mx-auto max-w-3xl scroll-mt-6 px-4 py-16 sm:px-6 md:py-20">
          <h2 id="faq-heading" className="font-display text-3xl font-semibold tracking-normal md:text-4xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-6">
            {faqs.map(([question, answer], index) => <AccordionItem key={question} value={`faq-${index}`}><AccordionTrigger className="min-h-12 gap-4 text-base">{question}</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">{answer}</AccordionContent></AccordionItem>)}
          </Accordion>
        </section>
        <section aria-labelledby="cta-heading" className="border-y bg-accent px-4 py-14 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8"><div className="max-w-xl"><h2 id="cta-heading" className="font-display text-3xl font-semibold tracking-normal">Give every complaint the attention it deserves.</h2><p className="mt-3 text-muted-foreground">Start with 14 days of all Growth features. No card required.</p></div><div className="flex flex-wrap gap-3"><TrialLink /><Button asChild variant="outline" size="lg"><a href={demoUrl}>Book a demo</a></Button></div></div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-8 sm:px-6">
        <Logo /><nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground"><Link to="/privacy" className="hover:text-primary">Privacy policy</Link><Link to="/dpa" className="hover:text-primary">DPA</Link><a href={`mailto:${CONTACT_EMAIL}`} className="break-all hover:text-primary">{CONTACT_EMAIL}</a></nav>
      </footer>
    </div>
  );
}
