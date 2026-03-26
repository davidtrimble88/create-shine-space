import { useEffect, useState } from "react";
import { BarChart3, Eye, Users, MousePointerClick, TrendingUp, Globe } from "lucide-react";

interface PageStat {
  page: string;
  views: number;
  uniqueVisitors: number;
}

const WebsiteAnalytics = () => {
  const [stats, setStats] = useState<PageStat[]>([]);

  useEffect(() => {
    // Placeholder analytics data — will be replaced with real tracking in Phase 3
    setStats([
      { page: "Home", views: 0, uniqueVisitors: 0 },
      { page: "Courses", views: 0, uniqueVisitors: 0 },
      { page: "About", views: 0, uniqueVisitors: 0 },
      { page: "Contact", views: 0, uniqueVisitors: 0 },
      { page: "Registration", views: 0, uniqueVisitors: 0 },
    ]);
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Website Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor website traffic and user engagement. Full analytics integration coming in Phase 3.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Page Views", value: "—", icon: Eye, color: "text-accent" },
          { label: "Unique Visitors", value: "—", icon: Users, color: "text-blue-400" },
          { label: "Avg. Session Duration", value: "—", icon: MousePointerClick, color: "text-purple-400" },
          { label: "Bounce Rate", value: "—", icon: TrendingUp, color: "text-green-400" },
        ].map((card, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg bg-secondary flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Page breakdown */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Globe className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-foreground">Pages</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Page</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Views</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Unique Visitors</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="p-4 text-foreground font-medium">{s.page}</td>
                <td className="p-4 text-muted-foreground">{s.views || "—"}</td>
                <td className="p-4 text-muted-foreground">{s.uniqueVisitors || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-accent/5 border border-accent/20 rounded-xl p-5 text-center">
        <BarChart3 className="w-8 h-8 text-accent mx-auto mb-2" />
        <p className="text-sm text-foreground font-medium">Full Analytics Coming Soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          Google Analytics integration and built-in tracking will be set up in Phase 3.
        </p>
      </div>
    </div>
  );
};

export default WebsiteAnalytics;
