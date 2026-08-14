import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CheckCircle, Mail, Clock, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import Seo from "@/components/Seo";

const RegistrationConfirmation = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pending = params.get("pending") === "1";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo title={pending ? "Registration On Hold — Learn to Ride VC" : "Registration Confirmed — Learn to Ride VC"} description="Your motorcycle class registration details." path="/registration-confirmation" noindex />
      <Navbar />
      <main className="flex-1 px-4 pt-40 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-xl w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
              {pending ? <Clock className="w-12 h-12 text-accent" /> : <CheckCircle className="w-12 h-12 text-accent" />}
            </div>
          </div>

          {pending ? (
            <>
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  Almost There — Your Registration Is On Hold
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Everything you've completed has been saved. Because you're paying by cash, your seat is not reserved
                  yet — spots are only held once payment is received.
                </p>
              </div>

              <div className="bg-muted/50 border border-border rounded-xl p-6 space-y-3 text-left">
                <div className="flex items-center justify-center gap-2 text-accent">
                  <Phone className="w-5 h-5" />
                  <span className="font-semibold">Call our office to finish</span>
                </div>
                <p className="text-center">
                  <a href="tel:+18058270075" className="text-2xl font-bold text-foreground hover:underline">
                    (805) 827-0075
                  </a>
                </p>
                <p className="text-center text-muted-foreground">Monday – Friday, 9:00 AM – 5:00 PM</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Once we take your payment, we'll confirm your seat and email your class details. If your class fills
                  before we hear from you, we'll help you choose the next available date.
                </p>
              </div>
            </>
          ) : (
            <>
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
                    href="mailto:notify@learntoridevc.com"
                    className="text-accent font-semibold hover:underline"
                  >
                    notify@learntoridevc.com
                  </a>{" "}
                  within 24 hours with more class information, including details about your schedule, what to bring, and what to expect.
                </p>
                <p className="text-sm text-muted-foreground/80">
                  Please check your spam or junk folder if you don't see it in your inbox.
                </p>
              </div>
            </>
          )}

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

