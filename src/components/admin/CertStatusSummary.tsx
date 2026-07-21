import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

type CertKey = "cmsp_expires" | "irc_expires" | "arc_expires" | "cpr_expires";
const CERTS: CertKey[] = ["cmsp_expires", "irc_expires", "arc_expires", "cpr_expires"];

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const e = new Date(iso + "T00:00:00");
  return Math.round((e.getTime() - t.getTime()) / 86400000);
};

type Status = "valid" | "warn" | "expired" | "missing";
const classify = (iso: string | null): Status => {
  const d = daysUntil(iso);
  if (d === null) return "missing";
  if (d < 0) return "expired";
  if (d <= 30) return "warn";
  return "valid";
};

interface Props {
  /** When true, show counts across all instructors; otherwise only the current user's certs. */
  scope: "all" | "self";
  userId?: string;
}

const CertStatusSummary = ({ scope, userId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ valid: 0, warn: 0, expired: 0, missing: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("instructor_certifications")
        .select("user_id, cmsp_expires, irc_expires, arc_expires, cpr_expires");

      let rows: any[] = [];
      if (scope === "self") {
        if (!userId) { setLoading(false); return; }
        const { data } = await query.eq("user_id", userId);
        // If instructor has no row, treat as 4 missing certs so counts make sense
        rows = data && data.length > 0
          ? data
          : [{ user_id: userId, cmsp_expires: null, irc_expires: null, arc_expires: null, cpr_expires: null }];
      } else {
        // Restrict to active employees
        const { data: emps } = await supabase
          .from("employees")
          .select("user_id")
          .eq("is_active", true)
          .not("user_id", "is", null);
        const ids = (emps ?? []).map((e) => e.user_id!).filter(Boolean);
        if (!ids.length) { setLoading(false); return; }
        const { data } = await query.in("user_id", ids);
        const certMap = new Map((data ?? []).map((c: any) => [c.user_id, c]));
        rows = ids.map((id) => certMap.get(id) ?? {
          user_id: id, cmsp_expires: null, irc_expires: null, arc_expires: null, cpr_expires: null,
        });
      }

      const c = { valid: 0, warn: 0, expired: 0, missing: 0 };
      for (const r of rows) {
        for (const k of CERTS) {
          const s = classify(r[k]);
          c[s]++;
        }
      }
      setCounts(c);
      setLoading(false);
    })();
  }, [scope, userId]);

  const cards = [
    { key: "valid",   label: "Valid",         value: counts.valid,   Icon: CheckCircle2,  cls: "text-green-500"  },
    { key: "warn",    label: "Expiring soon", value: counts.warn,    Icon: Clock,         cls: "text-yellow-500" },
    { key: "expired", label: "Expired",       value: counts.expired, Icon: XCircle,       cls: "text-red-500"    },
    { key: "missing", label: "Not on file",   value: counts.missing, Icon: AlertTriangle, cls: "text-muted-foreground" },
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          {scope === "all" ? "Certification Status" : "My Certification Status"}
        </h2>
        <Link to="/employee-dashboard?tab=certifications" className="text-xs text-accent hover:underline">
          View full report →
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ key, label, value, Icon, cls }) => (
          <Link
            key={key}
            to="/employee-dashboard?tab=certifications"
            className="block bg-card border border-border rounded-xl p-4 transition-all hover:border-accent hover:shadow-md hover:shadow-accent/10"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className={`w-4 h-4 ${cls}`} /> {label}
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground">{loading ? "…" : value}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CertStatusSummary;
