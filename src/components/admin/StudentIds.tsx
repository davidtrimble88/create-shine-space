import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, IdCard, Download, Search, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface BookingRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  course: string | null;
  location_label: string | null;
  schedule_date: string | null;
  id_photo_path: string | null;
  guardian_id_photo_path: string | null;
  created_at: string;
}

const StudentIds = () => {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ row: BookingRow; which: "student" | "guardian" } | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, first_name, last_name, email, course, location_label, schedule_date, id_photo_path, guardian_id_photo_path, created_at")
        .or("id_photo_path.not.is.null,guardian_id_photo_path.not.is.null")
        .order("created_at", { ascending: false });
      if (error) {
        toast({ title: "Failed to load IDs", description: error.message, variant: "destructive" });
      } else {
        setRows((data as any[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) { setFileUrl(null); return; }
    const path = selected.which === "student" ? selected.row.id_photo_path : selected.row.guardian_id_photo_path;
    if (!path) { setFileUrl(null); return; }
    let revoke: string | null = null;
    setFileLoading(true);
    setFileUrl(null);
    (async () => {
      const { data, error } = await supabase.storage.from("id-photos").download(path);
      if (error || !data) {
        toast({ title: "Failed to load ID", description: error?.message, variant: "destructive" });
      } else {
        setIsPdf((data.type || "").includes("pdf") || path.toLowerCase().endsWith(".pdf"));
        const url = URL.createObjectURL(data);
        revoke = url;
        setFileUrl(url);
      }
      setFileLoading(false);
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [selected]);

  const downloadFile = async (row: BookingRow, which: "student" | "guardian") => {
    const path = which === "student" ? row.id_photo_path : row.guardian_id_photo_path;
    if (!path) return;
    const ext = path.split(".").pop() || "bin";
    const safeName = `ID_${which}_${row.first_name}_${row.last_name}.${ext}`.replace(/[^a-z0-9_.-]+/gi, "_");
    if (selected?.row.id === row.id && selected.which === which && fileUrl) {
      const a = document.createElement("a");
      a.href = fileUrl; a.download = safeName;
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const { data, error } = await supabase.storage.from("id-photos").download(path);
    if (error || !data) {
      toast({ title: "Download failed", description: error?.message, variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = safeName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtered = rows.filter(r => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.location_label || "").toLowerCase().includes(q) ||
      (r.course || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading IDs…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <IdCard className="w-5 h-5 text-accent" />
        <h2 className="text-2xl font-bold">Student IDs</h2>
        <span className="text-sm text-muted-foreground ml-2">{rows.length} on file</span>
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
              <th className="text-left px-3 py-2">Uploaded</th>
              <th className="text-left px-3 py-2">Student</th>
              <th className="text-left px-3 py-2">Course / Location</th>
              <th className="text-left px-3 py-2">Class Date</th>
              <th className="text-right px-3 py-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.first_name} {r.last_name}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{r.course || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.location_label || "—"}</div>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.schedule_date || "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap space-x-1">
                  {r.id_photo_path && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setSelected({ row: r, which: "student" })}>View</Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadFile(r, "student")}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {r.guardian_id_photo_path && (
                    <Button size="sm" variant="outline" onClick={() => setSelected({ row: r, which: "guardian" })}>
                      Guardian
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No IDs found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] w-full h-[95vh] p-3 sm:p-6 flex flex-col">
          {selected && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-base sm:text-lg">
                  {selected.which === "guardian" ? "Guardian ID" : "Student ID"} — {selected.row.first_name} {selected.row.last_name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selected.row.course || "—"} · {selected.row.location_label || "—"} · Class {selected.row.schedule_date || "—"}
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 min-h-0 rounded-lg border border-border bg-white overflow-auto flex items-center justify-center">
                {fileLoading && (
                  <div className="text-muted-foreground flex items-center">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ID…
                  </div>
                )}
                {!fileLoading && fileUrl && (
                  isPdf
                    ? <iframe src={`${fileUrl}#view=FitH&toolbar=1`} title="ID" className="w-full h-full" />
                    : <img src={fileUrl} alt="ID" className="max-w-full max-h-full object-contain" />
                )}
                {!fileLoading && !fileUrl && (
                  <div className="text-muted-foreground text-sm p-4 text-center">No file available.</div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 shrink-0 flex-wrap">
                {fileUrl && (
                  <Button variant="outline" onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}>
                    Open in new tab
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => downloadFile(selected.row, selected.which)}>
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentIds;
