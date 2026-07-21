import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Copy, Trash2, Ticket, DollarSign } from "lucide-react";

type DiscountCode = {
  id: string;
  code: string;
  amount_cents: number | null;
  notes: string | null;
  expires_at: string | null;
  used_at: string | null;
  used_by_email: string | null;
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

export default function AdminDiscounts() {
  const [settingCents, setSettingCents] = useState<number>(7500);
  const [settingDraft, setSettingDraft] = useState<string>("75");
  const [savingSetting, setSavingSetting] = useState(false);

  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);

  const [newCode, setNewCode] = useState<string>(genCode());
  const [newAmount, setNewAmount] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");
  const [newExpires, setNewExpires] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadAll = async () => {
    setLoadingCodes(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from("discount_settings").select("returning_student_amount_cents").eq("id", 1).maybeSingle(),
      supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    ]);
    if (s?.returning_student_amount_cents != null) {
      setSettingCents(s.returning_student_amount_cents);
      setSettingDraft(centsToDollars(s.returning_student_amount_cents));
    }
    setCodes((c ?? []) as DiscountCode[]);
    setLoadingCodes(false);
  };

  useEffect(() => { loadAll(); }, []);

  const saveSetting = async () => {
    const cents = dollarsToCents(settingDraft);
    if (cents == null) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSavingSetting(true);
    const { error } = await supabase
      .from("discount_settings")
      .update({ returning_student_amount_cents: cents, updated_at: new Date().toISOString() })
      .eq("id", 1);
    setSavingSetting(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setSettingCents(cents);
    toast({ title: "Discount amount updated", description: `Returning-student & default code discount is now $${centsToDollars(cents)}.` });
  };

  const createCode = async () => {
    const code = newCode.trim().toUpperCase();
    if (!code) {
      toast({ title: "Code required", variant: "destructive" });
      return;
    }
    const amountCents = newAmount.trim() ? dollarsToCents(newAmount) : null;
    if (newAmount.trim() && amountCents == null) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("discount_codes").insert({
      code,
      amount_cents: amountCents,
      notes: newNotes.trim() || null,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
    });
    setCreating(false);
    if (error) {
      toast({ title: "Could not create code", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Discount code created", description: code });
    setNewCode(genCode());
    setNewAmount("");
    setNewNotes("");
    setNewExpires("");
    loadAll();
  };

  const deleteCode = async (id: string) => {
    if (!confirm("Delete this discount code?")) return;
    const { error } = await supabase.from("discount_codes").delete().eq("id", id);
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
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Discounts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the returning-student discount amount and issue one-time discount codes for the Intermediate Course.
        </p>
      </div>

      {/* Discount amount setting */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Discount Amount</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          This amount applies to both the returning-student checkbox on the register page and any discount code created
          without a custom override. Changing it here rolls out immediately.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="disc-amount">Amount (USD)</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                id="disc-amount"
                type="number"
                min={0}
                step="0.01"
                value={settingDraft}
                onChange={(e) => setSettingDraft(e.target.value)}
                className="w-32"
              />
            </div>
          </div>
          <Button onClick={saveSetting} disabled={savingSetting}>
            {savingSetting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save amount"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Current: <span className="text-foreground font-medium">${centsToDollars(settingCents)}</span>
          </span>
        </div>
      </div>

      {/* Generate one-time code */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">Generate One-Time Discount Code</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Give a student a code they can enter on the register page. Leave the amount blank to use the current default
          (${centsToDollars(settingCents)}), or set a custom override. Each code works exactly once.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <Label htmlFor="new-code">Code</Label>
            <div className="flex gap-1 mt-1">
              <Input
                id="new-code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="uppercase"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setNewCode(genCode())}>
                🎲
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="new-amount">Custom amount (optional)</Label>
            <Input
              id="new-amount"
              type="number"
              min={0}
              step="0.01"
              placeholder={centsToDollars(settingCents)}
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="new-expires">Expires (optional)</Label>
            <Input
              id="new-expires"
              type="date"
              value={newExpires}
              onChange={(e) => setNewExpires(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={createCode} disabled={creating} className="w-full">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create code"}
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="new-notes">Notes (optional)</Label>
          <Textarea
            id="new-notes"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Who is this code for / why was it issued?"
            className="mt-1"
            rows={2}
          />
        </div>
      </div>

      {/* Existing codes */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Issued Codes</h2>
        {loadingCodes ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discount codes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2 pr-3">Created</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const status = c.used_at
                    ? { label: `Used${c.used_by_email ? ` — ${c.used_by_email}` : ""}`, cls: "text-muted-foreground" }
                    : expired
                    ? { label: "Expired", cls: "text-destructive" }
                    : { label: "Active", cls: "text-emerald-500" };
                  return (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-mono font-medium">
                        <button
                          className="inline-flex items-center gap-1 hover:text-accent"
                          onClick={() => copy(c.code)}
                          title="Copy"
                        >
                          {c.code} <Copy className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        ${centsToDollars(c.amount_cents ?? settingCents)}
                        {c.amount_cents == null && (
                          <span className="ml-1 text-xs text-muted-foreground">(default)</span>
                        )}
                      </td>
                      <td className={`py-2 pr-3 ${status.cls}`}>{status.label}</td>
                      <td className="py-2 pr-3">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 pr-3 max-w-xs truncate" title={c.notes ?? ""}>{c.notes || "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCode(c.id)}
                          className="text-destructive hover:text-destructive"
                        >
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
    </div>
  );
}
