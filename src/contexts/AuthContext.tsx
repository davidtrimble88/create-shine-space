import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "owner" | "admin" | "manager" | "employee" | "moderator";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  userRole: AppRole;
  loading: boolean;
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  userRole: "employee",
  loading: true,
  mustChangePassword: false,
  clearMustChangePassword: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<AppRole>("employee");
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const clearMustChangePassword = () => setMustChangePassword(false);

  const checkRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (data && data.length > 0) {
      const roles = data.map(r => r.role);
      if (roles.includes("owner")) {
        setIsAdmin(true);
        setUserRole("owner");
      } else if (roles.includes("admin")) {
        setIsAdmin(true);
        setUserRole("admin");
      } else if (roles.includes("manager")) {
        setIsAdmin(false);
        setUserRole("manager");
      } else {
        setIsAdmin(false);
        setUserRole(roles[0] as AppRole);
      }
    } else {
      setIsAdmin(false);
      setUserRole("employee");
    }
  };

  const checkMustChangePassword = async (userId: string) => {
    const { data } = await supabase
      .from("employees")
      .select("must_change_password")
      .eq("user_id", userId)
      .maybeSingle();
    setMustChangePassword(data?.must_change_password ?? false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
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
          setMustChangePassword(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkRole(session.user.id);
        checkMustChangePassword(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, userRole, loading, mustChangePassword, clearMustChangePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
