import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus, Send, Users, Search, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Employee = { user_id: string; full_name: string; email: string };
type Thread = {
  id: string;
  subject: string;
  created_by: string;
  is_broadcast: boolean;
  last_message_at: string;
  created_at: string;
};
type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
type Participant = { thread_id: string; user_id: string; last_read_at: string };

export default function MessagingCenter() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const canCompose = userRole === "owner" || userRole === "admin";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach((e) => m.set(e.user_id, e));
    return m;
  }, [employees]);

  const loadThreads = async () => {
    const { data } = await supabase
      .from("message_threads")
      .select("*")
      .order("last_message_at", { ascending: false });
    setThreads((data as Thread[]) || []);
    const { data: parts } = await supabase.from("message_thread_participants").select("*");
    setParticipants((parts as Participant[]) || []);
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from("employees")
      .select("user_id, full_name, email")
      .eq("is_active", true)
      .not("user_id", "is", null)
      .order("full_name");
    setEmployees((data as Employee[]) || []);
  };

  useEffect(() => {
    loadThreads();
    loadEmployees();
  }, []);

  // Realtime for threads/messages
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("messaging-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "message_threads" }, loadThreads)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_thread_participants" }, loadThreads)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (m.thread_id === activeId) {
          setMessages((prev) => [...prev, m]);
        }
        loadThreads();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, activeId]);

  // Load messages when thread selected
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", activeId)
        .order("created_at");
      setMessages((data as Message[]) || []);
      // mark read
      if (user) {
        await supabase
          .from("message_thread_participants")
          .update({ last_read_at: new Date().toISOString() })
          .eq("thread_id", activeId)
          .eq("user_id", user.id);
      }
    })();
  }, [activeId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !activeId || !user) return;
    const body = reply.trim();
    setReply("");
    const { error } = await supabase.from("messages").insert({
      thread_id: activeId,
      sender_id: user.id,
      body,
    });
    if (error) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
      setReply(body);
    }
  };

  const deleteThread = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    const { error } = await supabase.from("message_threads").delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    if (activeId === id) setActiveId(null);
    loadThreads();
  };

  const threadPreview = (t: Thread) => {
    const others = participants
      .filter((p) => p.thread_id === t.id && p.user_id !== t.created_by)
      .map((p) => employeeMap.get(p.user_id)?.full_name || "Unknown");
    if (t.is_broadcast) return "Broadcast to all employees";
    if (others.length === 0) return employeeMap.get(t.created_by)?.full_name || "";
    if (others.length <= 3) return others.join(", ");
    return `${others.slice(0, 2).join(", ")} +${others.length - 2}`;
  };

  const unreadCount = (t: Thread) => {
    if (!user) return 0;
    const me = participants.find((p) => p.thread_id === t.id && p.user_id === user.id);
    if (!me) return 0;
    return new Date(t.last_message_at) > new Date(me.last_read_at) ? 1 : 0;
  };

  const filteredThreads = threads.filter(
    (t) =>
      !search ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      threadPreview(t).toLowerCase().includes(search.toLowerCase())
  );

  const active = threads.find((t) => t.id === activeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">Send and receive messages with your team.</p>
        </div>
        {canCompose && (
          <Button onClick={() => setComposeOpen(true)}>
            <MessageSquarePlus className="w-4 h-4 mr-2" /> New Message
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border rounded-xl overflow-hidden bg-card min-h-[500px]">
        {/* Thread list */}
        <div className={`md:col-span-1 border-r border-border flex flex-col ${activeId ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filteredThreads.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
            )}
            {filteredThreads.map((t) => {
              const unread = unreadCount(t);
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${
                    activeId === t.id ? "bg-secondary" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>
                      {t.subject}
                    </span>
                    {unread > 0 && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                    {t.is_broadcast && <Users className="w-3 h-3" />}
                    {threadPreview(t)}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                  </div>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Conversation */}
        <div className={`md:col-span-2 flex flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <button
                    className="md:hidden text-xs text-accent mb-1"
                    onClick={() => setActiveId(null)}
                  >
                    ← Back
                  </button>
                  <h2 className="font-semibold truncate">{active.subject}</h2>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {active.is_broadcast && <Badge variant="secondary" className="text-[10px] py-0">Broadcast</Badge>}
                    {threadPreview(active)}
                  </p>
                </div>
                {active.created_by === user?.id && (
                  <Button size="sm" variant="ghost" onClick={() => deleteThread(active.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const name = employeeMap.get(m.sender_id)?.full_name || "Unknown";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                        mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}>
                        {!mine && <div className="text-[10px] font-medium opacity-70 mb-0.5">{name}</div>}
                        <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-border flex gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  className="resize-none"
                />
                <Button onClick={sendReply} disabled={!reply.trim()} className="self-end">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {canCompose && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          employees={employees.filter((e) => e.user_id !== user?.id)}
          onCreated={(id) => {
            setActiveId(id);
            loadThreads();
          }}
        />
      )}
    </div>
  );
}

function ComposeDialog({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  employees: Employee[];
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [broadcast, setBroadcast] = useState(false);
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) {
      setSubject("");
      setBody("");
      setSelected(new Set());
      setBroadcast(false);
      setQ("");
    }
  }, [open]);

  const filtered = employees.filter(
    (e) => !q || e.full_name?.toLowerCase().includes(q.toLowerCase()) || e.email?.toLowerCase().includes(q.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const send = async () => {
    if (!user || !subject.trim() || !body.trim()) return;
    const recipients = broadcast ? employees.map((e) => e.user_id) : Array.from(selected);
    if (recipients.length === 0) {
      toast({ title: "Choose at least one recipient", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data: thread, error: tErr } = await supabase
      .from("message_threads")
      .insert({ subject: subject.trim(), created_by: user.id, is_broadcast: broadcast })
      .select()
      .single();
    if (tErr || !thread) {
      setSending(false);
      return toast({ title: "Failed", description: tErr?.message, variant: "destructive" });
    }
    const rows = Array.from(new Set([...recipients, user.id])).map((uid) => ({
      thread_id: thread.id,
      user_id: uid,
    }));
    await supabase.from("message_thread_participants").insert(rows);
    const { error: mErr } = await supabase
      .from("messages")
      .insert({ thread_id: thread.id, sender_id: user.id, body: body.trim() });
    setSending(false);
    if (mErr) return toast({ title: "Failed", description: mErr.message, variant: "destructive" });
    toast({ title: "Message sent" });
    onCreated(thread.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 border border-border rounded-lg bg-secondary/40">
            <Checkbox
              id="broadcast"
              checked={broadcast}
              onCheckedChange={(v) => setBroadcast(!!v)}
            />
            <label htmlFor="broadcast" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <Users className="w-4 h-4" /> Send to all employees ({employees.length})
            </label>
          </div>

          {!broadcast && (
            <div className="space-y-2">
              <Input placeholder="Search employees..." value={q} onChange={(e) => setQ(e.target.value)} />
              <ScrollArea className="h-40 border border-border rounded-lg p-2">
                {filtered.map((e) => (
                  <label
                    key={e.user_id}
                    className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-secondary/50 rounded"
                  >
                    <Checkbox checked={selected.has(e.user_id)} onCheckedChange={() => toggle(e.user_id)} />
                    <span className="text-sm">{e.full_name}</span>
                    <span className="text-xs text-muted-foreground truncate">{e.email}</span>
                  </label>
                ))}
              </ScrollArea>
              <p className="text-xs text-muted-foreground">{selected.size} selected</p>
            </div>
          )}

          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            placeholder="Write your message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending || !subject.trim() || !body.trim()}>
            <Send className="w-4 h-4 mr-2" /> Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
