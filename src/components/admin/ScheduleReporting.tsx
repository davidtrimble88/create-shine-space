import { BarChart3, Users, MapPin } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

      <Tabs defaultValue="instructor-availability" className="w-full">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="instructor-availability" className="gap-2">
            <Users className="w-4 h-4" />
            Instructor Availability
          </TabsTrigger>
          <TabsTrigger value="schedule-coverage" className="gap-2">
            <MapPin className="w-4 h-4" />
            Schedule Coverage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instructor-availability" className="mt-4">
          <AvailabilityReport inline />
        </TabsContent>

        <TabsContent value="schedule-coverage" className="mt-4">
          <SiteCoverageReport inline />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScheduleReporting;
