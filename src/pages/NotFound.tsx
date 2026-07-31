import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import EditableText from "@/components/EditableText";
import Seo from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <Seo title="Page Not Found \u2014 Learn to Ride VC" description="The page you're looking for doesn't exist." path="/404" noindex />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">
          <EditableText contentKey="notfound.code" fallback="404" />
        </h1>
        <p className="mb-4 text-xl text-muted-foreground">
          <EditableText contentKey="notfound.message" fallback="Oops! Page not found" />
        </p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          <EditableText contentKey="notfound.link" fallback="Return to Home" />
        </a>
      </div>
    </div>
  );
};

export default NotFound;
