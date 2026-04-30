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
