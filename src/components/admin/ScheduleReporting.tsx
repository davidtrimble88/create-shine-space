import { BarChart3 } from "lucide-react";
import AvailabilityReport from "./AvailabilityReport";
import SiteCoverageReport from "./SiteCoverageReport";

const ScheduleReporting = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-accent" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Schedule Reporting</h2>
          <p className="text-sm text-muted-foreground">
            Instructor coverage and class distribution across every location.
          </p>
        </div>
      </div>

      <SiteCoverageReport inline />
      <AvailabilityReport inline />
    </div>
  );
};

export default ScheduleReporting;
