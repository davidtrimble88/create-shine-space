import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  Pencil,
} from "lucide-react";

interface SharedFile {
  id: string;
  display_name: string;
  description: string | null;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
  min_role: "owner" | "admin" | "manager" | "employee";
}

type MinRole = "owner" | "admin" | "manager" | "employee";

const ROLE_OPTIONS: { value: MinRole; label: string; description: string }[] = [
  { value: "employee", label: "All staff (Instructors and up)", description: "Everyone signed in can see this file" },
  { value: "manager", label: "Managers and up", description: "Hidden from Instructors" },
  { value: "admin", label: "Admins and Owners only", description: "Hidden from Instructors and Managers" },
  { value: "owner", label: "Owners only", description: "Hidden from everyone except Owners" },
];

const roleBadge = (role: MinRole) => {
  switch (role) {
    case "owner": return "Owners only";
    case "admin": return "Admins+";
    case "manager": return "Managers+";
    default: return null;
  }
};


const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDate = (iso: string) => formatPSTDate(iso);

const iconForMime = (mime: string | null) => {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return FileSpreadsheet;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("text")) return FileText;
  return FileIcon;
};

const AdminFiles = () => {
  const { user, userRole } = useAuth();
  const canManage = userRole === "owner" || userRole === "admin";
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [minRole, setMinRole] = useState<MinRole>("employee");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editFile, setEditFile] = useState<SharedFile | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editMinRole, setEditMinRole] = useState<MinRole>("employee");
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shared_files")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load files");
    } else {
      setFiles((data ?? []) as SharedFile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !displayName) {
      setDisplayName(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const resetUploadForm = () => {
    setDisplayName("");
    setDescription("");
    setMinRole("employee");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please choose a file");
      return;
    }
    if (!displayName.trim()) {
      toast.error("Please give the file a name");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("File too large (max 50 MB)");
      return;
    }
    setUploading(true);
    const ext = selectedFile.name.split(".").pop() ?? "bin";
    const safeBase = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}`;

    const { error: uploadErr } = await supabase.storage
      .from("shared-files")
      .upload(path, selectedFile, {
        contentType: selectedFile.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      toast.error("Upload failed: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { error: insertErr } = await supabase.from("shared_files").insert({
      display_name: displayName.trim(),
      description: description.trim() || null,
      file_path: path,
      file_size: selectedFile.size,
      mime_type: selectedFile.type || null,
      min_role: minRole,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: user?.email ?? null,
    });

    if (insertErr) {
      // Roll back the storage object
      await supabase.storage.from("shared-files").remove([path]);
      toast.error("Failed to save file info");
      setUploading(false);
      return;
    }

    toast.success("File uploaded");
    setUploadOpen(false);
    resetUploadForm();
    setUploading(false);
    loadFiles();
  };

  const handleDownload = async (f: SharedFile) => {
    setDownloadingId(f.id);
    // Preserve the original file extension so the OS opens it with the right app.
    const pathExt = f.file_path.includes(".")
      ? f.file_path.split(".").pop()!.toLowerCase()
      : "";
    const nameHasExt = /\.[a-z0-9]{1,6}$/i.test(f.display_name);
    // Sanitize the display name for use as a filename (avoid ":", "/", etc.)
    const safeBase = f.display_name.replace(/[\\/:*?"<>|]+/g, "-").trim();
    const downloadName = nameHasExt || !pathExt ? safeBase : `${safeBase}.${pathExt}`;
    const { data, error } = await supabase.storage
      .from("shared-files")
      .createSignedUrl(f.file_path, 60, { download: downloadName });
    setDownloadingId(null);
    if (error || !data?.signedUrl) {
      toast.error("Could not get download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const file = files.find((f) => f.id === deleteId);
    if (!file) return;

    const { error: storageErr } = await supabase.storage
      .from("shared-files")
      .remove([file.file_path]);
    if (storageErr) {
      toast.error("Failed to delete file from storage");
      return;
    }
    const { error: rowErr } = await supabase
      .from("shared_files")
      .delete()
      .eq("id", file.id);
    if (rowErr) {
      toast.error("Failed to delete record");
      return;
    }
    toast.success("File deleted");
    setDeleteId(null);
    loadFiles();
  };

  const openEdit = (f: SharedFile) => {
    setEditFile(f);
    setEditName(f.display_name);
    setEditDescription(f.description ?? "");
    setEditMinRole(f.min_role ?? "employee");
  };

  const saveEdit = async () => {
    if (!editFile) return;
    if (!editName.trim()) {
      toast.error("Name required");
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from("shared_files")
      .update({
        display_name: editName.trim(),
        description: editDescription.trim() || null,
        min_role: editMinRole,
      })
      .eq("id", editFile.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Failed to save changes");
      return;
    }
    toast.success("File updated");
    setEditFile(null);
    loadFiles();
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">Files</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {canManage
              ? "Upload documents, forms, and resources for staff to view and download."
              : "Documents, forms, and resources shared by management."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No files yet.
              {canManage && " Click \"Upload File\" to add one."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((f) => {
              const Icon = iconForMime(f.mime_type);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate flex items-center gap-2 flex-wrap">
                      <span className="truncate">{f.display_name}</span>
                      {roleBadge(f.min_role) && (
                        <Badge variant="outline" className="text-[10px] font-medium border-accent/40 text-accent shrink-0">
                          {roleBadge(f.min_role)}
                        </Badge>
                      )}
                    </div>
                    {f.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {f.description}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground/70 mt-1 flex flex-wrap gap-x-3">
                      <span>{formatBytes(f.file_size)}</span>
                      <span>Added {formatDate(f.created_at)}</span>
                      <span>Updated {formatDate(f.updated_at)}</span>
                      {f.uploaded_by_name && (
                        <span className="truncate">by {f.uploaded_by_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(f)}
                      disabled={downloadingId === f.id}
                    >
                      {downloadingId === f.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-1.5" /> Download
                        </>
                      )}
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(f)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(f.id)}
                          title="Delete"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload dialog */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          setUploadOpen(o);
          if (!o) resetUploadForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Files uploaded here are visible to all signed-in staff.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-input">File (max 50 MB)</Label>
              <Input
                id="file-input"
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFile.name} • {formatBytes(selectedFile.size)}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. New Hire Onboarding Packet"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe what this file is for"
                rows={3}
              />
            </div>
            <div>
              <Label>Visible to</Label>
              <Select value={minRole} onValueChange={(v) => setMinRole(v as MinRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editFile} onOpenChange={(o) => !o && setEditFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit File Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Display Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Visible to</Label>
              <Select value={editMinRole} onValueChange={(v) => setEditMinRole(v as MinRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFile(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the file from storage. Staff will no longer be able to download it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFiles;
