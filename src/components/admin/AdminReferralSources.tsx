import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, ListPlus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type ReferralSource = Tables<"referral_sources">;

const AdminReferralSources = () => {
  const { toast } = useToast();
  const [sources, setSources] = useState<ReferralSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [edits, setEdits] = useState<Record<string, { name: string; sort_order: number }>>({});

  const fetchSources = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("referral_sources")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Error loading", description: error.message, variant: "destructive" });
    } else {
      setSources(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSources(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (name.length > 100) {
      toast({ title: "Name too long", description: "Max 100 characters.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const maxOrder = sources.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { error } = await supabase.from("referral_sources").insert({
      name,
      sort_order: maxOrder + 10,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Couldn't add", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Added", description: `"${name}" added to referral list.` });
      setNewName("");
      fetchSources();
    }
  };

  const handleToggleActive = async (s: ReferralSource) => {
    const { error } = await supabase
      .from("referral_sources")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
    } else {
      setSources(prev => prev.map(p => p.id === s.id ? { ...p, is_active: !p.is_active } : p));
    }
  };

  const handleSaveRow = async (s: ReferralSource) => {
    const edit = edits[s.id];
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("referral_sources")
      .update({ name, sort_order: edit.sort_order })
      .eq("id", s.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved" });
      setEdits(prev => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
      fetchSources();
    }
  };

  const handleDelete = async (s: ReferralSource) => {
    if (!confirm(`Delete "${s.name}" from the referral list? Existing bookings keep their value.`)) return;
    const { error } = await supabase.from("referral_sources").delete().eq("id", s.id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      setSources(prev => prev.filter(p => p.id !== s.id));
    }
  };

  const updateEdit = (id: string, patch: Partial<{ name: string; sort_order: number }>) => {
    setEdits(prev => {
      const current = prev[id] ?? { name: sources.find(s => s.id === id)?.name ?? "", sort_order: sources.find(s => s.id === id)?.sort_order ?? 0 };
      return { ...prev, [id]: { ...current, ...patch } };
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListPlus className="w-6 h-6 text-accent" /> Referral Sources
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the "How did you hear about us?" options shown on the booking and registration forms.
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="New referral source name (e.g. TikTok)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={100}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
            {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Add Source
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No referral sources yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-3 font-medium text-muted-foreground w-[90px]">Order</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-[110px]">Active</th>
                  <th className="text-right p-3 font-medium text-muted-foreground w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(s => {
                  const edit = edits[s.id];
                  const isDirty = !!edit && (edit.name.trim() !== s.name || edit.sort_order !== s.sort_order);
                  return (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="p-3">
                        <Input
                          type="number"
                          value={edit?.sort_order ?? s.sort_order}
                          onChange={e => updateEdit(s.id, { sort_order: parseInt(e.target.value) || 0 })}
                          className="w-20 h-9"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          value={edit?.name ?? s.name}
                          onChange={e => updateEdit(s.id, { name: e.target.value })}
                          maxLength={100}
                          className="h-9"
                        />
                      </td>
                      <td className="p-3">
                        <Switch checked={s.is_active} onCheckedChange={() => handleToggleActive(s)} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!isDirty}
                            onClick={() => handleSaveRow(s)}
                          >
                            <Save className="w-3.5 h-3.5 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(s)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Tip: Lower "Order" numbers appear first in the dropdown. Inactive sources are hidden from booking forms but kept on existing bookings.
      </p>
    </div>
  );
};

export default AdminReferralSources;
