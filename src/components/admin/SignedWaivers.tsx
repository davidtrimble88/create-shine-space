import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, Download, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SignedWaiver {
  id: string;
  document_version: string;
  document_hash: string;
  signer_first_name: string;
  signer_last_name: string;
  signer_email: string;
  signer_phone: string | null;
  date_of_birth: string | null;
  license_number: string | null;
  license_state: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_relationship: string | null;
  signature_typed: string;
  signature_drawn: string;
  guardian_signature_drawn: string | null;
  course: string | null;
  location_label: string | null;
  schedule_date: string | null;
  ip_address: string | null;
  user_agent: string | null;
  pdf_path: string | null;
  signed_at: string;
  consent_acknowledgments: any;
}

const SignedWaivers = () => {
  const [rows, setRows] = useState<SignedWaiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SignedWaiver | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!selected?.pdf_path) {
      setPdfUrl(null);
      return;
    }
    let revoke: string | null = null;
    setPdfLoading(true);
    setPdfUrl(null);
    (async () => {
      const { data, error } = await supabase.storage.from("waivers").download(selected.pdf_path!);
      if (error || !data) {
        toast({ title: "Failed to load PDF", description: error?.message, variant: "destructive" });
      } else {
        const blob = data.type ? data : new Blob([data], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setPdfUrl(url);
      }
      setPdfLoading(false);
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [selected]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("signed_waivers" as any)
        .select("*")
        .order("signed_at", { ascending: false });
      if (error) {
        toast({ title: "Failed to load waivers", description: error.message, variant: "destructive" });
      } else {
        setRows((data as any[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${r.signer_first_name} ${r.signer_last_name}`.toLowerCase().includes(q) ||
      r.signer_email.toLowerCase().includes(q) ||
      (r.location_label || "").toLowerCase().includes(q) ||
      (r.course || "").toLowerCase().includes(q)
    );
  });

  const downloadPdf = async (w: SignedWaiver) => {
    if (!w.pdf_path) {
      toast({ title: "No PDF", description: "PDF was not saved for this waiver.", variant: "destructive" });
      return;
    }
    const safe = `Signed_Waiver_${w.signer_first_name}_${w.signer_last_name}.pdf`.replace(/[^a-z0-9_.-]+/gi, "_");
    // Prefer already-loaded blob (avoids popup blockers)
    if (selected?.id === w.id && pdfUrl) {
      const a = document.createElement("a");
      a.href = pdfUrl; a.download = safe;
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const { data, error } = await supabase.storage.from("waivers").download(w.pdf_path);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = safe;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading waivers…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-accent" />
        <h2 className="text-2xl font-bold">Signed Waivers</h2>
        <span className="text-sm text-muted-foreground ml-2">{rows.length} total</span>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, course, location…"
          className="pl-9"
        />
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2">Signed</th>
              <th className="text-left px-3 py-2">Signer</th>
              <th className="text-left px-3 py-2">Course / Location</th>
              <th className="text-left px-3 py-2">Class Date</th>
              <th className="text-left px-3 py-2">Version</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(w => (
              <tr key={w.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(w.signed_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{w.signer_first_name} {w.signer_last_name}{w.is_minor && <span className="ml-2 text-xs text-accent">(minor)</span>}</div>
                  <div className="text-xs text-muted-foreground">{w.signer_email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{w.course || "—"}</div>
                  <div className="text-xs text-muted-foreground">{w.location_label || "—"}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{w.schedule_date || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{w.document_version}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => setSelected(w)}>View</Button>
                  <Button size="sm" variant="ghost" onClick={() => downloadPdf(w)} className="ml-1">
                    <Download className="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No waivers found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] w-full h-[95vh] p-3 sm:p-6 flex flex-col">
          {selected && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-base sm:text-lg">Signed Waiver — {selected.signer_first_name} {selected.signer_last_name}</DialogTitle>
                <DialogDescription className="text-xs">
                  Electronically signed {new Date(selected.signed_at).toLocaleString()} (ESIGN Act / UETA) · IP {selected.ip_address || "—"} · SHA-256 {selected.document_hash?.slice(0, 16)}…
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 rounded-lg border border-border bg-white overflow-hidden">
                {pdfLoading && (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading signed PDF…
                  </div>
                )}
                {!pdfLoading && pdfUrl && (
                  <iframe src={`${pdfUrl}#view=FitH&toolbar=1`} title="Signed waiver PDF" className="w-full h-full" />
                )}
                {!pdfLoading && !pdfUrl && (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                    No signed PDF was saved for this waiver record.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 shrink-0 flex-wrap">
                {pdfUrl && (
                  <Button variant="outline" onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}>
                    Open in new tab
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => downloadPdf(selected)} disabled={!selected.pdf_path}>
                  <Download className="w-4 h-4 mr-2" /> Download Signed PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded bg-muted/30 border border-border px-3 py-2">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div>{value}</div>
  </div>
);

export default SignedWaivers;
