import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  hint?: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/heic,application/pdf";

const IdPhotoUpload = ({ label, value, onChange, hint }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Max 8 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("id-photos").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) throw error;
      onChange(path);
      setFileName(file.name);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
      toast({ title: "ID uploaded" });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
    setUploading(false);
  };

  const clear = () => {
    onChange(null);
    setPreviewUrl(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label} *</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          {uploading ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Uploading…</>
          ) : (
            <>
              <Upload className="w-6 h-6 text-accent" />
              <span className="font-medium text-foreground">Tap to upload or take a photo</span>
              <span className="text-xs">JPG, PNG, HEIC or PDF · max 8 MB</span>
            </>
          )}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
          {previewUrl ? (
            <img src={previewUrl} alt="ID preview" className="w-16 h-16 object-cover rounded-md border border-border" />
          ) : (
            <div className="w-16 h-16 rounded-md bg-accent/10 border border-border flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-accent" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{fileName || "ID uploaded"}</p>
            <p className="text-xs text-muted-foreground">Securely stored — only staff can view</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="text-muted-foreground">
            <X className="w-4 h-4 mr-1" /> Replace
          </Button>
        </div>
      )}
    </div>
  );
};

export default IdPhotoUpload;
