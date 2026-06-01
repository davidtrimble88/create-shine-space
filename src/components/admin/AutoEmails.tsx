import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Mail, Plus, Pencil, Trash2, Eye, Save } from "lucide-react";

type Template = {
  id: string;
  trigger_event: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  enabled: boolean;
  available_variables: string[];
  updated_at: string;
};

const TRIGGER_OPTIONS: { value: string; label: string }[] = [
  { value: "registration_confirmation", label: "After Registration (Student)" },
];

const SAMPLE_VARS: Record<string, string> = {
  firstName: "Alex",
  lastName: "Rider",
  course: "Motorcycle Training Course",
  locationLabel: "Ventura",
  scheduleDate: "Sat, Jun 14, 2025",
  schedule: "Sat 8am–5pm & Sun 8am–5pm",
  fee: "$350",
  email: "alex@example.com",
};

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

const AutoEmails = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auto_email_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Could not load templates", description: error.message, variant: "destructive" });
    } else {
      setTemplates((data as Template[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const payload = {
      trigger_event: editing.trigger_event,
      name: editing.name.trim(),
      description: editing.description?.trim() || null,
      subject: editing.subject.trim(),
      body: editing.body,
      enabled: editing.enabled,
      available_variables: editing.available_variables,
    };
    let error;
    if (editing.id) {
      ({ error } = await supabase.from("auto_email_templates").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("auto_email_templates").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template saved" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    const { error } = await supabase.from("auto_email_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Template deleted" });
    load();
  };

  const toggleEnabled = async (t: Template) => {
    const { error } = await supabase
      .from("auto_email_templates")
      .update({ enabled: !t.enabled })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-7 h-7 text-accent" /> Auto Emails
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage the automatic emails sent to students based on system events.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              id: "",
              trigger_event: "registration_confirmation",
              name: "",
              description: "",
              subject: "",
              body: "",
              enabled: true,
              available_variables: Object.keys(SAMPLE_VARS),
              updated_at: "",
            })
          }
        >
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No templates yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {t.name}
                      <Badge variant={t.enabled ? "default" : "secondary"}>
                        {t.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Trigger:{" "}
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.trigger_event}</code>
                      {t.description ? <span className="block mt-1">{t.description}</span> : null}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={t.enabled} onCheckedChange={() => toggleEnabled(t)} />
                    <Button size="sm" variant="outline" onClick={() => setPreview(t)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  <div className="font-medium text-foreground">Subject</div>
                  <div className="text-muted-foreground mb-3">{t.subject}</div>
                  <div className="font-medium text-foreground">Body preview</div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4 mt-1">
                    {t.body}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Trigger Event</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={editing.trigger_event}
                  onChange={(e) => setEditing({ ...editing, trigger_event: e.target.value })}
                  disabled={!!editing.id}
                >
                  {TRIGGER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description (internal)</Label>
                <Input
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={editing.subject}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  placeholder="Your registration for {{course}} is confirmed"
                />
              </div>
              <div>
                <Label>Body</Label>
                <Textarea
                  rows={12}
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  placeholder={"Hi {{firstName}},\n\n..."}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Use placeholders like <code>{`{{firstName}}`}</code>,{" "}
                  <code>{`{{course}}`}</code>, <code>{`{{scheduleDate}}`}</code>. Available:{" "}
                  {editing.available_variables.map((v) => (
                    <code key={v} className="bg-muted px-1 rounded mr-1">{`{{${v}}}`}</code>
                  ))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing.enabled}
                  onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                />
                <Label className="!mt-0">Enabled (send automatically)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview (with sample data)</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Subject</div>
                <div className="font-medium">{render(preview.subject, SAMPLE_VARS)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Body</div>
                <pre className="bg-muted p-4 rounded text-sm whitespace-pre-wrap">
                  {render(preview.body, SAMPLE_VARS)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoEmails;
