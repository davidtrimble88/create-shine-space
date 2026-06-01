import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mail, Save, Loader2 } from "lucide-react";

// Triggers in the system that can be auto-BCC'd
const TRIGGERS: { value: string; label: string }[] = [
  { value: "registration_confirmation", label: "After Registration (Student)" },
  { value: "class_location_time", label: "Class Location & Time (Pre-Class)" },
  { value: "employee_welcome", label: "New Employee Welcome (with temp password)" },
  { value: "password_reset", label: "Admin Password Reset (with temp password)" },
];

const BccSettings = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [bccEmail, setBccEmail] = useState("davidharrisontrimble@icloud.com");
  const [excluded, setExcluded] = useState<string[]>([]);

  useEffect(() => {
    if (userRole !== "owner") { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("email_bcc_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (data) {
        setEnabled(data.enabled);
        setBccEmail(data.bcc_email);
        setExcluded(data.excluded_triggers ?? []);
      }
      setLoading(false);
    })();
  }, [userRole]);

  if (userRole !== "owner") return null;

  const toggleExcluded = (trigger: string, isIncluded: boolean) => {
    setExcluded((prev) =>
      isIncluded ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("email_bcc_settings")
      .update({
        enabled,
        bcc_email: bccEmail.trim(),
        excluded_triggers: excluded,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "BCC settings saved" });
    }
  };

  return (
    <Card className="border-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-accent" /> Owner BCC Settings
        </CardTitle>
        <CardDescription>
          Automatically blind-copy an address on auto-generated emails. Owner-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="text-sm font-medium">Enable BCC</Label>
                <p className="text-xs text-muted-foreground">Master switch — turns BCC off for every template.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div>
              <Label>BCC Address</Label>
              <Input
                type="email"
                value={bccEmail}
                onChange={(e) => setBccEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={!enabled}
              />
            </div>

            <div>
              <Label className="block mb-2">Receive BCC for these templates</Label>
              <div className="space-y-2 rounded-lg border border-border p-3">
                {TRIGGERS.map((t) => {
                  const isIncluded = !excluded.includes(t.value);
                  return (
                    <label
                      key={t.value}
                      className="flex items-center gap-3 cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={isIncluded}
                        disabled={!enabled}
                        onCheckedChange={() => toggleExcluded(t.value, isIncluded)}
                      />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Uncheck a template to stop receiving BCCs of those emails.
              </p>
            </div>

            <Button onClick={save} disabled={saving}>
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Save Settings</>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BccSettings;
