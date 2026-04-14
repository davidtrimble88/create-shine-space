import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const RegistrationConfirmation = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-xl w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-accent" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Thank You for Trusting Learn to Ride VC!
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We're honored to be part of your motorcycle safety and skill journey. Your registration has been received and we're excited to have you join us!
            </p>
          </div>

          <div className="bg-muted/50 border border-border rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-accent">
              <Mail className="w-5 h-5" />
              <span className="font-semibold">What's Next?</span>
            </div>
            <p className="text-muted-foreground">
              You will receive an email from{" "}
              <a
                href="mailto:office@learntoridevc.com"
                className="text-accent font-semibold hover:underline"
              >
                office@learntoridevc.com
              </a>{" "}
              within 24 hours with more class information, including details about your schedule, what to bring, and what to expect.
            </p>
            <p className="text-sm text-muted-foreground/80">
              Please check your spam or junk folder if you don't see it in your inbox.
            </p>
          </div>

          <div className="pt-4">
            <Button variant="hero" size="lg" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
};

export default RegistrationConfirmation;
