import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const pageNames: Record<string, string> = {
  "/": "Home",
  "/courses": "Courses",
  "/about": "About",
  "/contact": "Contact",
  "/choose-course": "Choose Course",
  "/choose-location": "Choose Location",
  "/choose-schedule": "Choose Schedule",
  "/register": "Registration",
};

const getVisitorId = () => {
  let id = localStorage.getItem("ltrvc_visitor_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ltrvc_visitor_id", id);
  }
  return id;
};

const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const name = pageNames[path] || path;
    const visitorId = getVisitorId();

    supabase.from("page_views").insert({
      page_path: path,
      page_name: name,
      visitor_id: visitorId,
    }).then(() => {});
  }, [location.pathname]);

  return null;
};

export default PageViewTracker;
