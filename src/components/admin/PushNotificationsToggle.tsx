import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  ensureServiceWorker,
  enablePush,
  disablePush,
  getPushStatus,
  type PushStatus,
} from "@/lib/push";

interface Props {
  compact?: boolean;
}

const PushNotificationsToggle = ({ compact }: Props) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      await ensureServiceWorker();
      setStatus(await getPushStatus());
    })();
  }, []);

  if (status === "unsupported") return null;
  if (status === "preview") {
    return compact ? null : (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <BellOff className="w-4 h-4" /> Push works only on the published app
      </Button>
    );
  }

  const onEnable = async () => {
    setBusy(true);
    const res = await enablePush();
    setBusy(false);
    if (res.ok) {
      setStatus("subscribed");
      toast({ title: "Phone notifications on", description: "We'll ping this device when you get a new notification." });
    } else if (res.reason === "denied" || res.reason === "blocked") {
      toast({ title: "Permission blocked", description: "Enable notifications for this site in your browser settings.", variant: "destructive" });
    } else {
      toast({ title: "Could not enable", description: res.reason ?? "Try again from your phone after installing to home screen.", variant: "destructive" });
    }
  };

  const onDisable = async () => {
    setBusy(true);
    await disablePush();
    setStatus(await getPushStatus());
    setBusy(false);
    toast({ title: "Phone notifications off", description: "This device will no longer receive pushes." });
  };

  if (status === "subscribed") {
    return (
      <Button variant="outline" size="sm" onClick={onDisable} disabled={busy} className="gap-2">
        <BellRing className="w-4 h-4 text-accent" />
        {compact ? "On" : "Notifications on"}
      </Button>
    );
  }
  if (status === "blocked") {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2">
        <BellOff className="w-4 h-4" />
        {compact ? "Blocked" : "Notifications blocked"}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onEnable} disabled={busy} className="gap-2">
      <Bell className="w-4 h-4" />
      {compact ? "Enable" : "Enable phone notifications"}
    </Button>
  );
};

export default PushNotificationsToggle;
