import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Share, Plus, MoreVertical, Download, ArrowLeft } from "lucide-react";
import appIcon from "/app-icon-192.png";

const InstallApp = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to website
        </Link>

        <div className="text-center mb-10">
          <img
            src={appIcon}
            alt="Learn to Ride VC Staff app icon"
            width={96}
            height={96}
            className="mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h1 className="text-3xl font-bold text-foreground">Install the Staff App</h1>
          <p className="text-muted-foreground mt-2">
            Add the employee portal to your phone's home screen for one-tap access.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* iPhone */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-accent" /> iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="font-bold text-accent">1.</span>
                <p>Open this page in <strong>Safari</strong> (not Chrome).</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">2.</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Tap the <Share className="inline w-4 h-4" /> Share button at the bottom.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">3.</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Scroll and tap <strong className="flex items-center gap-1"><Plus className="inline w-4 h-4" /> Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">4.</span>
                <p>Tap <strong>Add</strong>. The app icon will appear on your home screen.</p>
              </div>
            </CardContent>
          </Card>

          {/* Android */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-accent" /> Android
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="font-bold text-accent">1.</span>
                <p>Open this page in <strong>Chrome</strong>.</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">2.</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Tap the <MoreVertical className="inline w-4 h-4" /> menu (top right).
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">3.</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Tap <strong className="flex items-center gap-1"><Download className="inline w-4 h-4" /> Install app</strong> (or "Add to Home screen").
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-accent">4.</span>
                <p>Confirm. The app icon will appear on your home screen.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-card border border-border text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Tip:</strong> Once installed, tapping the icon opens the app
            in fullscreen — no browser bar — straight to the employee login. Sign in once and stay logged in.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <Link to="/employee-login">
            <Button size="lg">Go to Employee Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
