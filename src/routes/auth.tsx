import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" } => (s["mode"] === "signup" ? { mode: "signup" } : {}),
  head: () => ({
    meta: [
      { title: "Sign in — Redress" },
      { name: "description", content: "Sign in to Redress or start your 14-day free trial." },
      { property: "og:title", content: "Sign in — Redress" },
      { property: "og:description", content: "Sign in to Redress or start your 14-day free trial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  name: z.string().trim().max(100).optional(),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const [signup, setSignup] = useState(mode === "signup");
  const [busy, setBusy] = useState(false);
  const [resetOpen,setResetOpen] = useState(false);
  const [resetEmail,setResetEmail] = useState('');
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Invalid input"); return; }
    setBusy(true);
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/app`, data: { full_name: parsed.data.name } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  async function requestReset(e:React.FormEvent) {
    e.preventDefault();
    const parsed=z.string().trim().email('Enter a valid email').max(255).safeParse(resetEmail);
    if(!parsed.success){toast.error('Enter a valid email.');return;}
    setBusy(true);
    try {
      const {error}=await supabase.auth.resetPasswordForEmail(parsed.data,{redirectTo:window.location.origin+'/reset-password'});
      if(error)throw error;
      toast.success('If an account exists, a password-reset email will be sent.');
      setResetOpen(false);
    } catch {toast.error('Could not request a reset email. Please try again.');}
    finally {setBusy(false);}
  }

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between"><Link to="/"><Logo /></Link></div>
        <h1 className="mt-8 text-2xl font-semibold">{signup ? "Start your free trial" : "Sign in"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {signup ? "14 days, all Growth features, no card required." : "Welcome back."}
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={google}>Continue with Google</Button>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          {signup && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={signup ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{signup ? "Create account" : "Sign in"}</Button>
        </form>
        {!signup && <Button variant="link" className="mt-2 px-0" onClick={()=>{setResetEmail(form.email);setResetOpen(!resetOpen);}}>Forgot password?</Button>}
        {resetOpen && !signup && <form onSubmit={requestReset} className="mt-3 space-y-3 border-t pt-4"><Label htmlFor="reset-email">Work email</Label><Input id="reset-email" required type="email" autoComplete="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)}/><Button className="min-h-12 w-full" disabled={busy}>Send reset email</Button></form>}
        <Button variant="link" className="mt-6 h-auto whitespace-normal px-0 text-left" onClick={() => {setSignup(!signup);setResetOpen(false);}}>
          {signup ? "Already have an account? Sign in" : "New to Redress? Start a free trial"}
        </Button>
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground"><Link to="/privacy" className="hover:text-primary">Privacy policy</Link><Link to="/dpa" className="hover:text-primary">Data processing agreement</Link></div>
      </div>
    </main>
  );
}
