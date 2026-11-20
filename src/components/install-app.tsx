import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { installPlatform } from "@/lib/device";
import { cn } from "@/lib/utils";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIP | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIP; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
  const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const h = window.location.hostname;
  const preview =
    h.startsWith("id-preview--") || h.startsWith("preview--") || h === "localhost" ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(h) || /(^|\.)beta\.lovable\.dev$/.test(h);
  const off = new URLSearchParams(window.location.search).get("sw") === "off";
  if ("serviceWorker" in navigator) {
    if (import.meta.env.PROD && !inIframe && !preview && !off) {
      window.addEventListener("load", () => { void navigator.serviceWorker.register("/sw.js"); });
    } else {
      void navigator.serviceWorker.getRegistrations().then((rs) =>
        rs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).forEach((r) => void r.unregister()));
    }
  }
}

const STEPS: Record<ReturnType<typeof installPlatform>, { title: string; steps: string[] }> = {
  "ios-safari": { title: "iPhone or iPad (Safari)", steps: ["Tap the Share button.", "Choose “Add to Home Screen”.", "Tap Add."] },
  "ios-other": { title: "iPhone or iPad", steps: ["Open this page in Safari first.", "Tap the Share button.", "Choose “Add to Home Screen”."] },
  android: { title: "Android (Chrome)", steps: ["Tap the ⋮ menu.", "Choose “Install app” or “Add to Home screen”.", "Confirm."] },
  samsung: { title: "Samsung Internet", steps: ["Tap the menu (☰).", "Choose “Add page to” → “Home screen”."] },
  firefox: { title: "Firefox", steps: ["On Android: tap ⋮ → “Install”.", "On desktop, Firefox does not install apps. Use Chrome or Edge."] },
  "mac-safari": { title: "Safari on Mac", steps: ["In Safari 17 or later: open File → Add to Dock.", "Confirm Add.", "On older Safari, open this page in Chrome or Edge to install it."] },
  desktop: { title: "Chrome or Edge on desktop", steps: ["Click the install icon at the right of the address bar,", "or open the ⋮ menu and choose “Install Redress”."] },
};

export function InstallAppButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "ghost" | "default" }) {
  const [installed, setInstalled] = useState(false);
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  async function click() {
    if (deferred) {
      await deferred.prompt();
      const r = await deferred.userChoice;
      if (r.outcome === "accepted") setInstalled(true);
      deferred = null;
      return;
    }
    setOpen(true);
  }
  const [platform, setPlatform] = useState<ReturnType<typeof installPlatform>>("desktop");
  useEffect(() => { setPlatform(installPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)); }, []);
  const p = STEPS[platform];
  if (installed) return null;

  return (
    <>
      <Button variant={variant} size="sm" className={cn(className)} onClick={click}>
        <Download aria-hidden="true" className="h-4 w-4" /> Download the app
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>Install Redress</SheetTitle></SheetHeader>
          <p className="mt-2 text-sm font-medium">{p.title}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {p.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          <Button className="mt-6 h-12 w-full" onClick={() => setOpen(false)}>Done</Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
