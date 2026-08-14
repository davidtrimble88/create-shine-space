import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, MapPin, BarChart3 } from "lucide-react";
import AvailabilityReport from "./AvailabilityReport";
import SiteCoverageReport from "./SiteCoverageReport";

const ScheduleReporting = () => {
  const [openReport, setOpenReport] = useState<"availability" | "coverage" | null>(null);

  const cards = [
    {
      id: "availability" as const,
      icon: Users,
      title: "Instructor Availability Report",
      description:
        "Every active instructor's scheduled classes, submitted availability and placeholder days, with a summary at the top.",
    },
    {
      id: "coverage" as const,
      icon: MapPin,
      title: "Schedule Coverage by Location",
      description:
        "Side-by-side counts of MTC, IRC/1DPC and ARC classes per site, plus the full list of upcoming class dates for each location.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-accent" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Schedule Reporting</h2>
          <p className="text-sm text-muted-foreground">Printable reports on instructor coverage and class distribution.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(card => (
          <div key={card.id} className="border border-border rounded-xl p-5 bg-card flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-foreground">{card.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground flex-1">{card.description}</p>
            <Button className="mt-4 w-full sm:w-auto" onClick={() => setOpenReport(card.id)}>
              Open report
            </Button>
          </div>
        ))}
      </div>

      {openReport === "availability" && <AvailabilityReport onClose={() => setOpenReport(null)} />}
      {openReport === "coverage" && <SiteCoverageReport onClose={() => setOpenReport(null)} />}
    </div>
  );
};

export default ScheduleReporting;
