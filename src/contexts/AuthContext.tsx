import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logPortalError } from "@/lib/errorLog";
import { AlertTriangle } from "lucide-react";

type AppRole = "owner" | "admin" | "manager" | "employee" | "moderator";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  userRole: AppRole;
  effectiveRole: AppRole;
  viewAsRole: AppRole | null;
  setViewAsRole: (role: AppRole | null) => void;
  loading: boolean;
  roleUnavailable: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  userRole: "employee",
  effectiveRole: "employee",
  viewAsRole: null,
  setViewAsRole: () => {},
  loading: true,
  roleUnavailable: false,
  mustChangePassword: false,
  clearMustChangePassword: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ROLE_CACHE_PREFIX = "cachedUserRole:";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const readCachedRole = (userId: string): AppRole | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROLE_CACHE_PREFIX + userId);
    return (raw as AppRole | null) ?? null;
  } catch {
    return null;
  }
};

const writeCachedRole = (userId: string, role: AppRole) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROLE_CACHE_PREFIX + userId, role);
  } catch {
    /* ignore */
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>("employee");
  const [loading, setLoading] = useState(true);
  const [roleUnavailable, setRoleUnavailable] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem("viewAsRole");
    return (stored as AppRole | null) ?? null;
  });

  const setViewAsRole = (role: AppRole | null) => {
    setViewAsRoleState(role);
    if (typeof window !== "undefined") {
      if (role) window.localStorage.setItem("viewAsRole", role);
      else window.localStorage.removeItem("viewAsRole");
    }
  };

  // Only owners can impersonate; if owner clears or non-owner logs in, drop override
  const effectiveRole: AppRole = userRole === "owner" && viewAsRole ? viewAsRole : userRole;

  const clearMustChangePassword = () => setMustChangePassword(false);

  const applyRoles = (roles: string[]) => {
    let resolved: AppRole;
    if (roles.includes("owner")) resolved = "owner";
    else if (roles.includes("admin")) resolved = "admin";
    else if (roles.includes("manager")) resolved = "manager";
    else resolved = (roles[0] as AppRole) ?? "employee";
    setIsAdmin(resolved === "owner" || resolved === "admin");
    setUserRole(resolved);
    return resolved;
  };

  // Resolve the signed-in user's role. NEVER silently downgrade to "employee"
  // because of a network/database hiccup: retry, then fall back to the last
  // known role for this account, and surface a warning instead.
  const checkRole = async (userId: string) => {
    const delays = [0, 800, 2000, 4000];
    let lastError: unknown = null;

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await sleep(delays[attempt]);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error) {
        const roles = (data ?? []).map((r) => r.role as string);
        const resolved = applyRoles(roles);
        if (roles.length > 0) writeCachedRole(userId, resolved);
        setRoleUnavailable(false);
        return;
      }
      lastError = error;
    }

    logPortalError({ context: "portal_load_role_lookup", error: lastError });

    const cached = readCachedRole(userId);
    if (cached) {
      setIsAdmin(cached === "owner" || cached === "admin");
      setUserRole(cached);
    }
    setRoleUnavailable(true);
  };

  const checkMustChangePassword = async (userId: string) => {
    const { data, error } = await supabase
      .from("employees")
      .select("must_change_password")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      logPortalError({ context: "portal_load_employee_lookup", error });
      return; // leave the current value alone on a failed lookup
    }
    setMustChangePassword(data?.must_change_password ?? false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use the last known role immediately so the portal never renders
          // a downgraded view while the lookup is in flight.
          const cached = readCachedRole(session.user.id);
          if (cached) {
            setIsAdmin(cached === "owner" || cached === "admin");
            setUserRole(cached);
          }
          setTimeout(() => checkRole(session.user.id), 0);
          setTimeout(() => checkMustChangePassword(session.user.id), 0);
          if (event === "SIGNED_IN") {
            supabase.from("employee_logins").insert({
              user_id: session.user.id,
              email: session.user.email ?? "",
            }).then(() => {});
          }
        } else {
          setIsAdmin(false);
          setUserRole("employee");
          setRoleUnavailable(false);
          setMustChangePassword(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const cached = readCachedRole(session.user.id);
        if (cached) {
          setIsAdmin(cached === "owner" || cached === "admin");
          setUserRole(cached);
        }
        checkRole(session.user.id);
        checkMustChangePassword(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (typeof window !== "undefined" && user) {
      try {
        window.localStorage.removeItem(ROLE_CACHE_PREFIX + user.id);
      } catch {
        /* ignore */
      }
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, userRole, effectiveRole, viewAsRole, setViewAsRole, loading, roleUnavailable, mustChangePassword, clearMustChangePassword, signOut }}>
      {roleUnavailable && (
        <div className="sticky top-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Connection trouble — some information may be out of date or missing. Please refresh in a moment before making changes.
          </span>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
};
