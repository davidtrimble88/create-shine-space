import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useSiteContent } from "@/contexts/SiteContentContext";

interface EditableTextProps {
  contentKey: string;
  fallback: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "h4";
  className?: string;
  multiline?: boolean;
  children?: (text: string) => React.ReactNode;
}

const EditableText = ({
  contentKey,
  fallback,
  as: Tag = "span",
  className = "",
  multiline = false,
  children,
}: EditableTextProps) => {
  const { getContent, updateContent, isOwner } = useSiteContent();
  const text = getContent(contentKey, fallback);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) {
      await updateContent(contentKey, trimmed);
    } else {
      setDraft(text);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(text);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") cancel();
  };

  // If children render function is provided, use it for complex content
  if (children && !editing) {
    return (
      <span
        className={`relative inline ${isOwner ? "group/edit cursor-pointer" : ""}`}
        onMouseEnter={() => isOwner && setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => isOwner && setEditing(true)}
      >
        {children(text)}
        {isOwner && hovering && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="absolute -top-2 -right-6 z-50 w-5 h-5 bg-accent text-accent-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  }

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1.5 relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`bg-background border-2 border-accent rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y min-h-[60px] w-full ${className}`}
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`bg-background border-2 border-accent rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 ${className}`}
            style={{ width: `${Math.max(draft.length + 2, 10)}ch` }}
          />
        )}
        <button
          onClick={save}
          className="w-7 h-7 bg-accent text-accent-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={cancel}
          className="w-7 h-7 bg-muted text-muted-foreground rounded-full flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </span>
    );
  }

  return (
    <Tag
      className={`relative ${isOwner ? "group/edit cursor-pointer hover:ring-2 hover:ring-accent/30 hover:ring-offset-2 rounded transition-all" : ""} ${className}`}
      onMouseEnter={() => isOwner && setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => isOwner && setEditing(true)}
    >
      {text}
      {isOwner && hovering && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="absolute -top-2 -right-6 z-50 w-5 h-5 bg-accent text-accent-foreground rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
    </Tag>
  );
};

export default EditableText;
