import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, Save, ShieldAlert, KeyRound, ExternalLink, Copy } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

type Provider = "square" | "paypal" | "stripe";
type Mode = "sandbox" | "live";

interface Settings {
  id: string;
  active_provider: Provider;
  square_enabled: boolean;
  paypal_enabled: boolean;
  stripe_enabled: boolean;
  square_mode: Mode;
  paypal_mode: Mode;
  stripe_mode: Mode;
  notes: string | null;
  updated_at: string;
}

const providerInfo: Record<Provider, { label: string; description: string; ready: boolean; readyNote: string }> = {
  square: {
    label: "Square",
    description: "Accept cards via Square Web Payments SDK. Currently the only fully wired provider.",
    ready: true,
    readyNote: "Live and ready — Ventura & High Desert keys configured.",
  },
  paypal: {
    label: "PayPal",
    description: "Accept PayPal balance and cards via PayPal Checkout.",
    ready: false,
    readyNote: "Adapter scaffolded. Needs PayPal Client ID & Secret to go live.",
  },
  stripe: {
    label: "Stripe",
    description: "Accept cards via Stripe Checkout / Payment Element.",
    ready: false,
    readyNote: "Adapter scaffolded. Needs Stripe API keys to go live.",
  },
};

const PaymentSettings = () => {
  const { user, userRole } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to load payment settings", description: error.message, variant: "destructive" });
    } else if (data) {
      setSettings(data as Settings);
    }
    setLoading(false);
  };

  if (userRole !== "owner") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" /> Owner Only
          </CardTitle>
          <CardDescription>You don't have permission to manage payment settings.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading payment settings…
      </div>
    );
  }

  const update = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("payment_settings")
      .update({
        active_provider: settings.active_provider,
        square_enabled: settings.square_enabled,
        paypal_enabled: settings.paypal_enabled,
        stripe_enabled: settings.stripe_enabled,
        square_mode: settings.square_mode,
        paypal_mode: settings.paypal_mode,
        stripe_mode: settings.stripe_mode,
        notes: settings.notes,
        updated_by: user?.id ?? null,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment settings saved", description: `Active provider: ${providerInfo[settings.active_provider].label}` });
    }
  };

  const activeInfo = providerInfo[settings.active_provider];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-accent" /> Payment Settings
        </h2>
        <p className="text-muted-foreground mt-1">
          Choose which payment provider students use at checkout. You can switch at any time.
        </p>
      </div>

      {/* Active provider */}
      <Card>
        <CardHeader>
          <CardTitle>Active Payment Provider</CardTitle>
          <CardDescription>
            New bookings will be charged through this provider. Currently active:{" "}
            <strong className="text-foreground">{activeInfo.label}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.active_provider}
            onValueChange={(v) => update({ active_provider: v as Provider })}
            className="space-y-3"
          >
            {(Object.keys(providerInfo) as Provider[]).map((p) => {
              const info = providerInfo[p];
              return (
                <div
                  key={p}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    settings.active_provider === p ? "border-accent bg-accent/5" : "border-border"
                  }`}
                >
                  <RadioGroupItem value={p} id={`prov-${p}`} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={`prov-${p}`} className="flex items-center gap-2 cursor-pointer">
                      <span className="font-semibold">{info.label}</span>
                      {info.ready ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/50">
                          <AlertTriangle className="w-3 h-3" /> Not yet configured
                        </Badge>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">{info.description}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1 italic">{info.readyNote}</p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          {!providerInfo[settings.active_provider].ready && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span className="text-foreground">
                Heads up — <strong>{activeInfo.label}</strong> isn't fully wired yet. Students hitting checkout
                will see a "not yet configured" message. Switch back to Square (or another configured provider)
                until {activeInfo.label} credentials are set up.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-provider config */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Configuration</CardTitle>
          <CardDescription>
            Enable providers and toggle test/live mode. Disabled providers cannot be made active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {(Object.keys(providerInfo) as Provider[]).map((p) => {
            const enabledKey = `${p}_enabled` as keyof Settings;
            const modeKey = `${p}_mode` as keyof Settings;
            return (
              <div key={p} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center pb-4 border-b border-border last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{providerInfo[p].label}</p>
                  <p className="text-xs text-muted-foreground">{providerInfo[p].ready ? "Ready" : "Pending setup"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={settings[enabledKey] as boolean}
                    onCheckedChange={(v) => update({ [enabledKey]: v } as Partial<Settings>)}
                  />
                  <Label className="text-sm">Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Mode:</Label>
                  <Select
                    value={settings[modeKey] as Mode}
                    onValueChange={(v) => update({ [modeKey]: v as Mode } as Partial<Settings>)}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Test</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Credentials setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-accent" /> Provider Credentials
          </CardTitle>
          <CardDescription>
            API keys are stored as encrypted backend secrets — never in the database or browser.
            Expand a provider below for step-by-step setup instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="square">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  Square <Badge variant="default" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Configured</Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Square is fully wired with separate credentials per location (Ventura & High Desert).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    "SQUARE_VENTURA_APP_ID",
                    "SQUARE_VENTURA_ACCESS_TOKEN",
                    "SQUARE_VENTURA_LOCATION_ID",
                    "SQUARE_HIGH_DESERT_APP_ID",
                    "SQUARE_HIGH_DESERT_ACCESS_TOKEN",
                    "SQUARE_HIGH_DESERT_LOCATION_ID",
                  ].map((s) => (
                    <code key={s} className="text-xs bg-muted px-2 py-1 rounded">{s} ✓</code>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  To rotate or update a Square key, ask in chat: "Update Square Ventura access token."
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="paypal">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  PayPal{" "}
                  <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/50">
                    <AlertTriangle className="w-3 h-3" /> Needs credentials
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    Go to{" "}
                    <a
                      href="https://developer.paypal.com/dashboard/applications/live"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      PayPal Developer Dashboard <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Create a new <strong>Live</strong> REST API app (or open your existing one)</li>
                  <li>Copy the <strong>Client ID</strong> and <strong>Secret</strong></li>
                  <li>Click the button below — paste them into the secure form Lovable shows you</li>
                </ol>
                <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                  <p className="font-semibold">Required secret names:</p>
                  <code className="block">PAYPAL_CLIENT_ID</code>
                  <code className="block">PAYPAL_CLIENT_SECRET</code>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast({
                      title: "Ask Lovable to set up PayPal",
                      description:
                        'In chat, type: "Add PayPal credentials" — a secure form will pop up to enter your Client ID & Secret.',
                    })
                  }
                >
                  <KeyRound className="w-4 h-4 mr-2" /> How to add PayPal keys
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="stripe">
              <AccordionTrigger>
                <span className="flex items-center gap-2">
                  Stripe{" "}
                  <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/50">
                    <AlertTriangle className="w-3 h-3" /> Needs credentials
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm">
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    Go to{" "}
                    <a
                      href="https://dashboard.stripe.com/apikeys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent inline-flex items-center gap-1 hover:underline"
                    >
                      Stripe API Keys <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Copy your <strong>Publishable key</strong> (pk_live_…) and <strong>Secret key</strong> (sk_live_…)</li>
                  <li>Create a webhook endpoint and copy its <strong>Signing secret</strong> (whsec_…)</li>
                  <li>Click the button below — paste them into Lovable's secure form</li>
                </ol>
                <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                  <p className="font-semibold">Required secret names:</p>
                  <code className="block">STRIPE_PUBLISHABLE_KEY</code>
                  <code className="block">STRIPE_SECRET_KEY</code>
                  <code className="block">STRIPE_WEBHOOK_SECRET</code>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Webhook URL to paste into Stripe:
                  </p>
                  <code className="block break-all">
                    {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-webhook`}
                  </code>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast({
                      title: "Ask Lovable to set up Stripe",
                      description:
                        'In chat, type: "Add Stripe credentials" — a secure form will pop up to enter your keys.',
                    })
                  }
                >
                  <KeyRound className="w-4 h-4 mr-2" /> How to add Stripe keys
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20 text-xs text-muted-foreground">
            <strong className="text-foreground">Why this flow?</strong> Payment API keys must be kept out of
            the codebase and database. Lovable provides an encrypted secret store for backend functions —
            asking in chat triggers a secure popup so your keys are never typed into a regular form or
            logged anywhere.
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Internal Notes</CardTitle>
          <CardDescription>Optional reminders for yourself (only owners can see).</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Switched to PayPal on April 30 to test new processor…"
            value={settings.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value })}
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={loadSettings} disabled={saving}>Reset</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Save className="w-4 h-4 mr-2" /> Save Settings</>}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(settings.updated_at).toLocaleString()}
      </p>
    </div>
  );
};

export default PaymentSettings;
