import { BadgeCheck } from "lucide-react";

const IdRequirementNote = ({ className = "" }: { className?: string }) => (
  <div className={`bg-accent/10 border border-accent/25 rounded-xl p-4 flex items-start gap-3 ${className}`}>
    <BadgeCheck className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
    <p className="text-sm text-foreground/85">
      <strong className="text-accent">ID Requirement:</strong> Every participant must present a valid,
      unexpired government-issued photo ID on class day. Students under 18 may present a current school
      photo ID, but their parent or legal guardian must also be present with their own valid
      government-issued photo ID showing their name.
    </p>
  </div>
);

export default IdRequirementNote;
