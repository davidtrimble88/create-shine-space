import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 20, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using the Learn to Ride VC website and services, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Services</h2>
            <p>Learn to Ride VC provides motorcycle training courses certified by the California Motorcyclist Safety Program (CMSP). Our services include but are not limited to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Basic Rider Course (BRC)</li>
               <li>Intermediate Rider Course</li>
               <li>Advanced Riding Clinic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Registration and Enrollment</h2>
            <p>To enroll in a course, you must meet the minimum age requirement and provide accurate personal information. Course availability is subject to change without notice. Full payment is required at the time of registration unless otherwise arranged.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Cancellation and Refund Policy</h2>
            <p>Cancellations made more than 72 hours before the scheduled course start date are eligible for a full refund or rescheduling. Cancellations made within 72 hours may be subject to a cancellation fee. No-shows are not eligible for refunds.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Assumption of Risk</h2>
            <p>Motorcycle riding involves inherent risks. By enrolling in our courses, you acknowledge and accept these risks. All participants are required to sign a liability waiver before participating in any riding activities.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Safety Requirements</h2>
            <p>Participants must wear appropriate safety gear during all riding sessions, including a DOT-approved helmet, long pants, over-the-ankle footwear, long-sleeved shirt or jacket, and full-fingered gloves. Learn to Ride VC reserves the right to dismiss any participant who fails to comply with safety requirements.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Intellectual Property</h2>
            <p>All content on this website, including text, images, logos, and course materials, is the property of Learn to Ride VC and is protected by copyright laws. Unauthorized use or reproduction is prohibited.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Limitation of Liability</h2>
            <p>Learn to Ride VC shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our services or website. Our total liability shall not exceed the amount paid for the specific course in question.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Changes to Terms</h2>
            <p>We reserve the right to modify these Terms of Service at any time. Changes will be posted on this page with an updated revision date. Continued use of our services constitutes acceptance of the modified terms.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">10. Contact Information</h2>
            <p>For questions about these Terms of Service, please contact us at:</p>
            <ul className="list-none space-y-1 mt-2">
              <li>Phone: (760) 403-8091</li>
              <li>Email: info@learntoridevc.com</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
