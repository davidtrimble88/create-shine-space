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
    setPdfLoading(true);
    setPdfUrl(null);
    supabase.storage.from("waivers").createSignedUrl(selected.pdf_path, 300).then(({ data, error }) => {
      if (error || !data) {
        toast({ title: "Failed to load PDF", description: error?.message, variant: "destructive" });
      } else {
        setPdfUrl(data.signedUrl);
      }
      setPdfLoading(false);
    });
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
    const { data, error } = await supabase.storage.from("waivers").createSignedUrl(w.pdf_path, 60);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Signed Waiver — {selected.signer_first_name} {selected.signer_last_name}</DialogTitle>
                <DialogDescription>
                  Electronically signed {new Date(selected.signed_at).toLocaleString()} (ESIGN Act / UETA)
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <Info label="Email" value={selected.signer_email} />
                <Info label="Phone" value={selected.signer_phone || "—"} />
                <Info label="DOB" value={selected.date_of_birth || "—"} />
                <Info label="License/ID" value={`${selected.license_number || "—"}${selected.license_state ? " (" + selected.license_state + ")" : ""}`} />
                <Info label="Course" value={selected.course || "—"} />
                <Info label="Location" value={selected.location_label || "—"} />
                <Info label="Class Date" value={selected.schedule_date || "—"} />
                <Info label="Document Version" value={selected.document_version} />
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Typed signature</div>
                <div className="text-lg font-serif italic">{selected.signature_typed}</div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Drawn signature</div>
                <img src={selected.signature_drawn} alt="signature" className="max-h-32 border border-border rounded bg-white" />
              </div>

              {selected.is_minor && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 space-y-2">
                  <div className="text-sm font-semibold">Guardian: {selected.guardian_name} ({selected.guardian_relationship})</div>
                  {selected.guardian_signature_drawn && (
                    <img src={selected.guardian_signature_drawn} alt="guardian signature" className="max-h-32 border border-border rounded bg-white" />
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-semibold mb-1">Audit trail</div>
                <div>IP: {selected.ip_address}</div>
                <div className="break-all">User agent: {selected.user_agent}</div>
                <div className="break-all">Document SHA-256: {selected.document_hash}</div>
                <div>Acknowledgments: {Array.isArray(selected.consent_acknowledgments) ? selected.consent_acknowledgments.length : 0} accepted</div>
              </div>

              <div className="flex justify-end">
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
