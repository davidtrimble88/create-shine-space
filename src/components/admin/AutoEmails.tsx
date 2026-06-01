import { useCallback, useEffect, useRef, useState } from "react";
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
import { Mail, Plus, Pencil, Trash2, Eye, Save, Paperclip, Upload, X, Bold, Italic, Underline, Highlighter, Type } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BccSettings from "./BccSettings";
import { useAuth } from "@/contexts/AuthContext";

type Attachment = { name: string; path: string; url: string; size?: number };

const LOCATION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any location" },
  { value: "high-desert-hesperia", label: "High Desert — Hesperia" },
  { value: "high-desert-wrightwood", label: "High Desert — Wrightwood" },
  { value: "ventura-county", label: "Ventura County — Somis" },
];
const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any group" },
  { value: "Group A", label: "Group A" },
  { value: "Group B", label: "Group B" },
];
const COURSE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any course" },
  { value: "basic", label: "Motorcycle Training Course (Basic)" },
  { value: "intermediate", label: "Intermediate Course" },
  { value: "advanced", label: "Advanced Course" },
];

type Template = {
  id: string;
  trigger_event: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  enabled: boolean;
  available_variables: string[];
  attachments: Attachment[];
  match_location: string | null;
  match_group: string | null;
  match_course: string | null;
  updated_at: string;
};

const TRIGGER_OPTIONS: { value: string; label: string; vars: string[] }[] = [
  {
    value: "registration_confirmation",
    label: "After Registration (Student)",
    vars: ["firstName", "lastName", "course", "locationLabel", "scheduleDate", "schedule", "fee", "email", "groupName"],
  },
  {
    value: "class_location_time",
    label: "Class Location & Time (Pre-Class Details)",
    vars: [
      "firstName", "lastName", "course", "locationLabel", "locationAddress",
      "scheduleDate", "classTime", "schedule", "mapLink", "contactPhone", "email",
    ],
  },
];

const SAMPLE_VARS: Record<string, string> = {
  firstName: "Alex",
  lastName: "Rider",
  course: "Motorcycle Training Course",
  locationLabel: "Ventura County — Somis",
  locationAddress: "5500 Somis Rd, Somis, CA 93066",
  scheduleDate: "Sat, Jun 14, 2025",
  classTime: "8:00 AM – 5:00 PM",
  schedule: "Sat 8am–5pm & Sun 8am–5pm",
  mapLink: "https://maps.google.com/?q=5500+Somis+Rd",
  contactPhone: "(805) 827-0075",
  fee: "$425",
  email: "alex@example.com",
  groupName: "Group A",
};

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

const renderWithAttachments = (body: string, vars: Record<string, string>, atts: Attachment[]) => {
  const rendered = render(body, vars);
  if (!atts?.length) return rendered;
  const list = atts.map((a) => `📎 ${a.name}: ${a.url}`).join("\n");
  return `${rendered}\n\n— Attachments —\n${list}`;
};

const AutoEmails = () => {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const { effectiveRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Normalize stored body to HTML for the WYSIWYG editor.
  // Plain-text templates have their newlines converted to <br> so they display correctly.
  const toHtml = (body: string) => {
    if (!body) return "";
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(body);
    return looksLikeHtml ? body : body.replace(/\n/g, "<br>");
  };

  // Callback ref: populate the contentEditable exactly once per mount with the saved body.
  // Using useCallback ensures React doesn't re-invoke this on every keystroke (which would
  // reset innerHTML and send the cursor back to the top).
  const initialBodyRef = useRef<string>("");
  const setBodyRef = useCallback((el: HTMLDivElement | null) => {
    bodyRef.current = el;
    if (el) {
      el.innerHTML = toHtml(initialBodyRef.current);
    }
  }, []);




  const exec = (command: string, value?: string) => {
    bodyRef.current?.focus();
    document.execCommand(command, false, value);
    if (bodyRef.current) {
      setEditing((prev) => (prev ? { ...prev, body: bodyRef.current!.innerHTML } : prev));
    }
  };

  const applyHighlight = () => exec("hiliteColor", "#fff59d");
  const applyFontSize = (px: string) => {
    // execCommand fontSize accepts 1-7; wrap selection in a span for exact px instead.
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !bodyRef.current) return;
    if (!bodyRef.current.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = px;
    try {
      range.surroundContents(span);
    } catch {
      // Selection spans multiple block elements — fall back to extract/insert.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    setEditing((prev) => (prev ? { ...prev, body: bodyRef.current!.innerHTML } : prev));
  };



  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auto_email_templates")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast({ title: "Could not load templates", description: error.message, variant: "destructive" });
    } else {
      setTemplates(
        ((data as any[]) || []).map((t) => ({
          ...t,
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
          match_location: t.match_location ?? null,
          match_group: t.match_group ?? null,
          match_course: t.match_course ?? null,
        })) as Template[],
      );
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
      attachments: editing.attachments as any,
      match_location: editing.match_location || null,
      match_group: editing.match_group || null,
      match_course: editing.match_course || null,
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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !editing) return;
    setUploading(true);
    try {
      const newAtts: Attachment[] = [...editing.attachments];
      for (const file of Array.from(files)) {
        // Supabase Storage rejects keys with non-ASCII chars (e.g. en-dash "–"),
        // spaces, and various punctuation. Sanitize while keeping the original
        // display name intact for the email attachment list.
        const safeName = file.name
          .normalize("NFKD")
          .replace(/[^\x00-\x7F]/g, "")        // drop non-ASCII (en-dash, smart quotes, etc.)
          .replace(/[^a-zA-Z0-9._-]+/g, "_")    // collapse anything else to underscore
          .replace(/_+/g, "_")
          .replace(/^_+|_+$/g, "")
          || "file";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("email-attachments")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("email-attachments").getPublicUrl(path);
        newAtts.push({ name: file.name, path, url: pub.publicUrl, size: file.size });
      }
      setEditing({ ...editing, attachments: newAtts });
      toast({ title: "Attachment(s) uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = async (idx: number) => {
    if (!editing) return;
    const a = editing.attachments[idx];
    try {
      await supabase.storage.from("email-attachments").remove([a.path]);
    } catch {/* non-fatal */}
    const next = editing.attachments.filter((_, i) => i !== idx);
    setEditing({ ...editing, attachments: next });
  };

  const triggerVars = (trigger: string) =>
    TRIGGER_OPTIONS.find((o) => o.value === trigger)?.vars ?? Object.keys(SAMPLE_VARS);

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
          onClick={() => {
            const body =
              "Hi {{firstName}},\n\n" +
              "Here are the details for your upcoming class:\n\n" +
              "Course: {{course}}\n" +
              "Date: {{scheduleDate}}\n" +
              "Time: {{classTime}}\n" +
              "Location: {{locationLabel}}\n" +
              "Address: {{locationAddress}}\n" +
              "Map: {{mapLink}}\n\n" +
              "Bike and helmet are provided. Please arrive 15 minutes early.\n\n" +
              "Questions? Call us at {{contactPhone}}.\n\n" +
              "See you soon,\nLearn To Ride VC";
            initialBodyRef.current = body;
            setEditing({
              id: "",
              trigger_event: "class_location_time",
              name: "Class Location & Time",
              description: "Sent ahead of class with location, time, and any attachments.",
              subject: "Your {{course}} on {{scheduleDate}} — Location & Time",
              body,
              enabled: true,
              available_variables: triggerVars("class_location_time"),
              attachments: [],
              match_location: null,
              match_group: null,
              match_course: null,
              updated_at: "",
            });
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      {userRole === "owner" && <BccSettings />}



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
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      {t.name}
                      <Badge variant={t.enabled ? "default" : "secondary"}>
                        {t.enabled ? "Active" : "Disabled"}
                      </Badge>
                      {t.attachments?.length ? (
                        <Badge variant="outline" className="gap-1">
                          <Paperclip className="w-3 h-3" /> {t.attachments.length}
                        </Badge>
                      ) : null}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Trigger:{" "}
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.trigger_event}</code>
                      {t.match_course ? (
                        <Badge variant="outline" className="ml-2">
                          {COURSE_OPTIONS.find((o) => o.value === t.match_course)?.label || t.match_course}
                        </Badge>
                      ) : null}
                      {t.match_location ? (
                        <Badge variant="outline" className="ml-1">
                          {LOCATION_OPTIONS.find((o) => o.value === t.match_location)?.label || t.match_location}
                        </Badge>
                      ) : null}
                      {t.match_group ? (
                        <Badge variant="outline" className="ml-1">{t.match_group}</Badge>
                      ) : null}
                      {t.description ? <span className="block mt-1">{t.description}</span> : null}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={t.enabled} onCheckedChange={() => toggleEnabled(t)} />
                    <Button size="sm" variant="outline" onClick={() => setPreview(t)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { initialBodyRef.current = t.body || ""; setEditing(t); }}>
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
                  {t.attachments?.length ? (
                    <div className="mt-3">
                      <div className="font-medium text-foreground mb-1">Attachments</div>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {t.attachments.map((a, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Paperclip className="w-3 h-3" />
                            <a href={a.url} target="_blank" rel="noreferrer" className="underline">
                              {a.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      trigger_event: e.target.value,
                      available_variables: triggerVars(e.target.value),
                    })
                  }
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
                <Label>Target Course</Label>
                <select
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={editing.match_course || ""}
                  onChange={(e) => setEditing({ ...editing, match_course: e.target.value || null })}
                >
                  {COURSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Target Location</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editing.match_location || ""}
                    onChange={(e) => setEditing({ ...editing, match_location: e.target.value || null })}
                  >
                    {LOCATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Target Group</Label>
                  <select
                    className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editing.match_group || ""}
                    onChange={(e) => setEditing({ ...editing, match_group: e.target.value || null })}
                  >
                    {GROUP_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                The most specific match wins. Use "Any" to act as a fallback.
              </p>

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
                  placeholder="Your {{course}} on {{scheduleDate}} — Location & Time"
                />
              </div>
              <div>
                <Label>Body</Label>
                <div className="flex flex-wrap items-center gap-1 border border-b-0 rounded-t-md bg-muted/40 p-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}>
                    <Bold className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}>
                    <Italic className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}>
                    <Underline className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" title="Highlight" onMouseDown={(e) => e.preventDefault()} onClick={applyHighlight}>
                    <Highlighter className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-1 ml-1" onMouseDown={(e) => e.preventDefault()}>
                    <Type className="w-4 h-4 text-muted-foreground" />
                    <Select onValueChange={applyFontSize}>
                      <SelectTrigger className="h-8 w-[110px] text-xs">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10px">Small (10px)</SelectItem>
                        <SelectItem value="12px">Normal (12px)</SelectItem>
                        <SelectItem value="14px">Medium (14px)</SelectItem>
                        <SelectItem value="18px">Large (18px)</SelectItem>
                        <SelectItem value="24px">X-Large (24px)</SelectItem>
                        <SelectItem value="32px">Huge (32px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto pr-2">Select text, then click a format</span>
                </div>
                <div
                  key={editing.id || "new"}
                  ref={setBodyRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) =>
                    setEditing({ ...editing, body: (e.target as HTMLDivElement).innerHTML })
                  }
                  className="min-h-[280px] border rounded-b-md p-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring whitespace-pre-wrap break-words"
                  data-placeholder="Hi {{firstName}}, ..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Available variables (click to insert):{" "}
                  {editing.available_variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => exec("insertText", `{{${v}}}`)}
                      className="bg-muted hover:bg-muted/70 px-1.5 py-0.5 rounded mr-1 font-mono text-xs"
                    >{`{{${v}}}`}</button>
                  ))}
                </p>
              </div>



              {/* Attachments */}
              <div>
                <Label className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Attachments
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Files are uploaded and included as download links at the bottom of the email.
                </p>
                <div className="space-y-2">
                  {editing.attachments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 text-sm"
                    >
                      <a href={a.url} target="_blank" rel="noreferrer" className="underline truncate">
                        {a.name}
                      </a>
                      <Button size="sm" variant="ghost" onClick={() => removeAttachment(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Uploading…" : "Upload files"}
                </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div
                  className="bg-muted p-4 rounded text-sm whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: renderWithAttachments(preview.body, SAMPLE_VARS, preview.attachments || []),
                  }}
                />

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoEmails;
