import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

interface SiteContentContextType {
  content: Record<string, string>;
  loading: boolean;
  isOwner: boolean;
  getContent: (key: string, fallback: string) => string;
  updateContent: (key: string, value: string) => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextType>({
  content: {},
  loading: true,
  isOwner: false,
  getContent: (_, fallback) => fallback,
  updateContent: async () => {},
});

export const useSiteContent = () => useContext(SiteContentContext);

export const SiteContentProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { userRole, user } = useAuth();
  const isOwner = userRole === "owner";

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("site_content").select("content_key, content_value");
      const map: Record<string, string> = {};
      data?.forEach((r) => { map[r.content_key] = r.content_value; });
      setContent(map);
      setLoading(false);
    };
    fetch();
  }, []);

  const getContent = useCallback(
    (key: string, fallback: string) => content[key] ?? fallback,
    [content]
  );

  const updateContent = useCallback(
    async (key: string, value: string) => {
      setContent((prev) => ({ ...prev, [key]: value }));
      const { data: existing } = await supabase
        .from("site_content")
        .select("id")
        .eq("content_key", key)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("site_content")
          .update({ content_value: value, updated_at: new Date().toISOString(), updated_by: user?.id })
          .eq("content_key", key);
      } else {
        await supabase
          .from("site_content")
          .insert({ content_key: key, content_value: value, updated_by: user?.id });
      }
    },
    [user]
  );

  return (
    <SiteContentContext.Provider value={{ content, loading, isOwner, getContent, updateContent }}>
      {children}
    </SiteContentContext.Provider>
  );
};
