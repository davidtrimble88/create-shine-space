import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Eraser } from "lucide-react";

export const SharedDocuSignPad = ({
  onSave, onCancel, prompt, defaultTyped, mode,
}: {
  onSave: (dataUrl: string, typed: string) => void;
  onCancel: () => void;
  prompt: string;
  defaultTyped: string;
  mode: "signature" | "initial";
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState(defaultTyped);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = mode === "initial" ? 3 : 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a2540";
  }, [tab, mode]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath(); ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y); ctx.stroke();
    dirty.current = true;
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
  };

  const buildTypedDataUrl = (text: string) => {
    const w = mode === "initial" ? 200 : 520;
    const h = mode === "initial" ? 90 : 110;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#0a2540";
    ctx.font = `${mode === "initial" ? 56 : 44}px "Brush Script MT", "Lucida Handwriting", cursive`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text || "", w / 2, h / 2);
    return c.toDataURL("image/png");
  };

  const handleSave = () => {
    if (tab === "draw") {
      if (!dirty.current) {
        toast({ title: "Please draw your " + mode, variant: "destructive" });
        return;
      }
      onSave(canvasRef.current!.toDataURL("image/png"), typed || defaultTyped);
    } else {
      const t = typed.trim();
      if (!t) { toast({ title: "Type your " + mode, variant: "destructive" }); return; }
      onSave(buildTypedDataUrl(t), t);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{prompt}</p>
      <div className="flex gap-2 border-b border-border">
        {(["draw", "type"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? "border-accent text-accent" : "border-transparent text-muted-foreground"
            }`}>
            {t === "draw" ? "Draw" : "Type"}
          </button>
        ))}
      </div>
      {tab === "draw" ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-white relative">
          <canvas ref={canvasRef}
            className={`w-full ${mode === "initial" ? "h-32" : "h-40"} touch-none rounded-lg`}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          <button type="button" onClick={clear}
            className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground bg-background/90 rounded px-2 py-1 flex items-center gap-1 border border-border">
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={defaultTyped}
            className="text-2xl"
            style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }} />
          <p className="text-xs text-muted-foreground">
            Preview will be rendered in a script-style font and stamped onto the document.
          </p>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="hero" onClick={handleSave}>Adopt and Sign</Button>
      </DialogFooter>
    </div>
  );
};
