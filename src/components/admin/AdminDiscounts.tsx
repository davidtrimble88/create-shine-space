import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Trash2, Ticket, DollarSign, Megaphone } from "lucide-react";

const COURSE_OPTIONS = [
  { id: "basic", label: "Motorcycle Training Course" },
  { id: "intermediate", label: "Intermediate Course" },
  { id: "advanced", label: "Advanced Riding Clinic" },
];

type DiscountCode = {
  id: string;
  code: string;
  amount_cents: number | null;
  notes: string | null;
  starts_at: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
  applies_to_courses: string[] | null;
  usage_type: "one_time" | "multi_use";
  max_uses: number | null;
  use_count: number;
  created_at: string;
};

const centsToDollars = (c: number | null | undefined) =>
  c == null ? "" : (c / 100).toFixed(c % 100 === 0 ? 0 : 2);

const dollarsToCents = (s: string): number | null => {
  const n = Number(String(s).replace(/[^0-9.]/g, ""));
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

const genCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const courseLabel = (id: string) =>
  COURSE_OPTIONS.find((c) => c.id === id)?.label ?? id;

export default function AdminDiscounts() {
  // Settings (three amounts)
  const [intCents, setIntCents] = useState<number>(7500);
  const [advCents, setAdvCents] = useState<number>(7500);
  const [promoCents, setPromoCents] = useState<number>(5000);
  const [intDraft, setIntDraft] = useState<string>("75");
  const [advDraft, setAdvDraft] = useState<string>("75");
  const [promoDraft, setPromoDraft] = useState<string>("50");
  const [savingSetting, setSavingSetting] = useState(false);

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);

  // One-time code creation
  const [newCode, setNewCode] = useState<string>(genCode());
  const [newAmount, setNewAmount] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");
  const [newExpires, setNewExpires] = useState<string>("");
  const [newCourses, setNewCourses] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Promotional code creation
  const [promoCode, setPromoCode] = useState<string>(genCode());
  const [promoAmount, setPromoAmount] = useState<string>("");
  const [promoNotes, setPromoNotes] = useState<string>("");
  const [promoStarts, setPromoStarts] = useState<string>("");
  const [promoEnds, setPromoEnds] = useState<string>("");
  const [promoMaxUses, setPromoMaxUses] = useState<string>("");
  const [promoCourses, setPromoCourses] = useState<string[]>([]);
  const [creatingPromo, setCreatingPromo] = useState(false);

  const loadAll = async () => {
    setLoadingCodes(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      (supabase as any).from("discount_settings")
        .select("intermediate_returning_amount_cents, advanced_returning_amount_cents, promo_default_amount_cents")
        .eq("id", 1).maybeSingle(),
      (supabase as any).from("discount_codes").select("*").order("created_at", { ascending: false }),
    ]);
    if (s) {
      if (s.intermediate_returning_amount_cents != null) {
        setIntCents(s.intermediate_returning_amount_cents);
        setIntDraft(centsToDollars(s.intermediate_returning_amount_cents));
      }
      if (s.advanced_returning_amount_cents != null) {
        setAdvCents(s.advanced_returning_amount_cents);
        setAdvDraft(centsToDollars(s.advanced_returning_amount_cents));
      }
      if (s.promo_default_amount_cents != null) {
        setPromoCents(s.promo_default_amount_cents);
        setPromoDraft(centsToDollars(s.promo_default_amount_cents));
      }
    }
    setCodes((c ?? []) as DiscountCode[]);
    setLoadingCodes(false);
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    const ic = dollarsToCents(intDraft);
    const ac = dollarsToCents(advDraft);
    const pc = dollarsToCents(promoDraft);
    if (ic == null || ac == null || pc == null) {
      toast({ title: "Invalid amount", description: "All three amounts must be valid dollars.", variant: "destructive" });
      return;
    }
    setSavingSetting(true);
    const { error } = await (supabase as any)
      .from("discount_settings")
      .update({
        intermediate_returning_amount_cents: ic,
        advanced_returning_amount_cents: ac,
        promo_default_amount_cents: pc,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSavingSetting(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setIntCents(ic); setAdvCents(ac); setPromoCents(pc);
    toast({ title: "Discount amounts updated" });
  };

  const toggleCourse = (list: string[], setter: (v: string[]) => void, id: string) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const createOneTime = async () => {
    const code = newCode.trim().toUpperCase();
    if (!code) { toast({ title: "Code required", variant: "destructive" }); return; }
    const amountCents = newAmount.trim() ? dollarsToCents(newAmount) : null;
    if (newAmount.trim() && amountCents == null) {
      toast({ title: "Invalid amount", variant: "destructive" }); return;
    }
    setCreating(true);
    const { error } = await (supabase as any).from("discount_codes").insert({
      code,
      amount_cents: amountCents,
      notes: newNotes.trim() || null,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
      applies_to_courses: newCourses,
      usage_type: "one_time",
    });
    setCreating(false);
    if (error) {
      toast({ title: "Could not create code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "One-time code created", description: code });
    setNewCode(genCode()); setNewAmount(""); setNewNotes(""); setNewExpires(""); setNewCourses([]);
    loadAll();
  };

  const createPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { toast({ title: "Code required", variant: "destructive" }); return; }
    const amountCents = promoAmount.trim() ? dollarsToCents(promoAmount) : null;
    if (promoAmount.trim() && amountCents == null) {
      toast({ title: "Invalid amount", variant: "destructive" }); return;
    }
    const maxUses = promoMaxUses.trim() ? parseInt(promoMaxUses, 10) : null;
    if (promoMaxUses.trim() && (!isFinite(maxUses as number) || (maxUses as number) < 1)) {
      toast({ title: "Invalid max uses", variant: "destructive" }); return;
    }
    if (promoStarts && promoEnds && new Date(promoStarts) > new Date(promoEnds)) {
      toast({ title: "Start must be before end", variant: "destructive" }); return;
    }
    setCreatingPromo(true);
    const { error } = await (supabase as any).from("discount_codes").insert({
      code,
      amount_cents: amountCents,
      notes: promoNotes.trim() || null,
      starts_at: promoStarts ? new Date(promoStarts).toISOString() : null,
      expires_at: promoEnds ? new Date(promoEnds).toISOString() : null,
      applies_to_courses: promoCourses,
      usage_type: "multi_use",
      max_uses: maxUses,
    });
    setCreatingPromo(false);
    if (error) {
      toast({ title: "Could not create promo code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Promotional code created", description: code });
    setPromoCode(genCode()); setPromoAmount(""); setPromoNotes("");
    setPromoStarts(""); setPromoEnds(""); setPromoMaxUses(""); setPromoCourses([]);
    loadAll();
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this discount code?")) return;
    const { error } = await (supabase as any).from("discount_codes").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setCodes((prev) => prev.filter((x) => x.id !== id));
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Copied", description: code });
    } catch { /* noop */ }
  };

  const renderCourseCheckboxes = (list: string[], setter: (v: string[]) => void) => (
    <div className="flex flex-wrap gap-3">
      {COURSE_OPTIONS.map((c) => (
        <label key={c.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={list.includes(c.id)}
            onCheckedChange={() => toggleCourse(list, setter, c.id)}
          />
          {c.label}
        </label>
      ))}
      <span className="text-xs text-muted-foreground self-center">
        (leave all unchecked = valid on any course)
      </span>
    </div>
  );

  const oneTimeCodes = codes.filter((c) => c.usage_type !== "multi_use");
  const promoCodes = codes.filter((c) => c.usage_type === "multi_use");

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage returning-student discount amounts, one-time discount codes, and promotional codes.
        </p>
      </div>

      {/* Amounts */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Discount Amounts</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Changing these amounts rolls out immediately to the register page and to any code
          that doesn't specify a custom amount.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Intermediate returning student</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" min={0} step="0.01" value={intDraft} onChange={(e) => setIntDraft(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current: ${centsToDollars(intCents)}</p>
          </div>
          <div>
            <Label>Advanced returning student</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" min={0} step="0.01" value={advDraft} onChange={(e) => setAdvDraft(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current: ${centsToDollars(advCents)}</p>
          </div>
          <div>
            <Label>Promotional default</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input type="number" min={0} step="0.01" value={promoDraft} onChange={(e) => setPromoDraft(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Current: ${centsToDollars(promoCents)}</p>
          </div>
        </div>
        <Button onClick={saveSettings} disabled={savingSetting}>
          {savingSetting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save amounts"}
        </Button>
      </div>

      {/* One-time code */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Generate One-Time Discount Code</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Single-use code for one student. Leave the amount blank to use the Intermediate returning amount
          (${centsToDollars(intCents)}).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Code</Label>
            <div className="flex gap-1 mt-1">
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="uppercase" />
              <Button type="button" variant="outline" size="sm" onClick={() => setNewCode(genCode())}>🎲</Button>
            </div>
          </div>
          <div>
            <Label>Custom amount (optional)</Label>
            <Input type="number" min={0} step="0.01" placeholder={centsToDollars(intCents)}
              value={newAmount} onChange={(e) => setNewAmount(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Expires (optional)</Label>
            <Input type="date" value={newExpires} onChange={(e) => setNewExpires(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={createOneTime} disabled={creating} className="w-full">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create code"}
            </Button>
          </div>
        </div>
        <div>
          <Label>Valid for these courses</Label>
          <div className="mt-2">{renderCourseCheckboxes(newCourses, setNewCourses)}</div>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} className="mt-1"
            placeholder="Who is this code for / why was it issued?" />
        </div>
      </div>

      {/* Promotional code */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Create Promotional Code</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Multi-use promotional code with a start and end date. Optionally cap total uses and restrict to
          specific courses. Leave amount blank to use the promotional default (${centsToDollars(promoCents)}).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Code</Label>
            <div className="flex gap-1 mt-1">
              <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} className="uppercase" />
              <Button type="button" variant="outline" size="sm" onClick={() => setPromoCode(genCode())}>🎲</Button>
            </div>
          </div>
          <div>
            <Label>Custom amount (optional)</Label>
            <Input type="number" min={0} step="0.01" placeholder={centsToDollars(promoCents)}
              value={promoAmount} onChange={(e) => setPromoAmount(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Max uses (optional)</Label>
            <Input type="number" min={1} step={1} placeholder="unlimited"
              value={promoMaxUses} onChange={(e) => setPromoMaxUses(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Starts</Label>
            <Input type="date" value={promoStarts} onChange={(e) => setPromoStarts(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Ends</Label>
            <Input type="date" value={promoEnds} onChange={(e) => setPromoEnds(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button onClick={createPromo} disabled={creatingPromo} className="w-full">
              {creatingPromo ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create promo"}
            </Button>
          </div>
        </div>
        <div>
          <Label>Valid for these courses</Label>
          <div className="mt-2">{renderCourseCheckboxes(promoCourses, setPromoCourses)}</div>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={promoNotes} onChange={(e) => setPromoNotes(e.target.value)} rows={2} className="mt-1"
            placeholder="Campaign, purpose, or channel." />
        </div>
      </div>

      {/* Codes tables */}
      <CodesTable
        title="One-Time Codes"
        codes={oneTimeCodes}
        loading={loadingCodes}
        defaultAmountCents={intCents}
        onCopy={copy}
        onDelete={deleteCode}
      />
      <CodesTable
        title="Promotional Codes"
        codes={promoCodes}
        loading={loadingCodes}
        defaultAmountCents={promoCents}
        onCopy={copy}
        onDelete={deleteCode}
      />
    </div>
  );
}

function CodesTable({
  title, codes, loading, defaultAmountCents, onCopy, onDelete,
}: {
  title: string;
  codes: DiscountCode[];
  loading: boolean;
  defaultAmountCents: number;
  onCopy: (c: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-4">{title}</h2>
      {loading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Courses</th>
                <th className="py-2 pr-3">Window</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Notes</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const now = new Date();
                const notStarted = c.starts_at && new Date(c.starts_at) > now;
                const expired = c.expires_at && new Date(c.expires_at) < now;
                const exhausted = c.usage_type === "multi_use" && c.max_uses != null && (c.use_count ?? 0) >= c.max_uses;
                let status: { label: string; cls: string };
                if (c.usage_type === "one_time") {
                  status = c.used_at
                    ? { label: `Used${c.used_by_email ? ` — ${c.used_by_email}` : ""}`, cls: "text-muted-foreground" }
                    : expired ? { label: "Expired", cls: "text-destructive" }
                    : notStarted ? { label: "Scheduled", cls: "text-muted-foreground" }
                    : { label: "Active", cls: "text-emerald-500" };
                } else {
                  status = exhausted
                    ? { label: `Used up (${c.use_count}/${c.max_uses})`, cls: "text-destructive" }
                    : expired ? { label: "Expired", cls: "text-destructive" }
                    : notStarted ? { label: "Scheduled", cls: "text-muted-foreground" }
                    : { label: `Active${c.max_uses != null ? ` (${c.use_count}/${c.max_uses})` : ` (${c.use_count} used)`}`, cls: "text-emerald-500" };
                }
                const courses = (c.applies_to_courses ?? []);
                return (
                  <tr key={c.id} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-mono font-medium">
                      <button className="inline-flex items-center gap-1 hover:text-accent" onClick={() => onCopy(c.code)} title="Copy">
                        {c.code} <Copy className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      ${centsToDollars(c.amount_cents ?? defaultAmountCents)}
                      {c.amount_cents == null && <span className="ml-1 text-xs text-muted-foreground">(default)</span>}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {courses.length === 0 ? <span className="text-muted-foreground">Any</span> : courses.map(courseLabel).join(", ")}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—"}
                      {" → "}
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-xs ${status.cls}`}>{status.label}</td>
                    <td className="py-2 pr-3 max-w-xs truncate text-xs" title={c.notes ?? ""}>{c.notes || "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
