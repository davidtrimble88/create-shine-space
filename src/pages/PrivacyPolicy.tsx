import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: March 20, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Name, email address, phone number, and mailing address</li>
              <li>Date of birth and driver's license information (required for CMSP courses)</li>
              <li>Payment information (processed securely through third-party providers)</li>
              <li>Course preferences and scheduling information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Process course registrations and payments</li>
              <li>Communicate with you about your courses and scheduling</li>
              <li>Send important safety and course-related updates</li>
              <li>Submit required documentation to the CMSP and DMV</li>
              <li>Improve our services and website experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. Information Sharing</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>The California Motorcyclist Safety Program (CMSP) as required for course certification</li>
              <li>The Department of Motor Vehicles (DMV) for license waivers</li>
              <li>Payment processors for secure transaction handling</li>
              <li>Law enforcement when required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Data Security</h2>
            <p>We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">5. Cookies and Tracking</h2>
            <p>Our website may use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and understand user preferences. You can control cookie settings through your browser preferences.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">6. Your Rights</h2>
            <p>Under California law (CCPA), you have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Request access to your personal information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt out of the sale of your personal information</li>
              <li>Non-discrimination for exercising your privacy rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">7. Children's Privacy</h2>
            <p>Our services are not directed to individuals under the age of 15½ (the minimum age for a motorcycle permit in California). We do not knowingly collect personal information from children under this age.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page with a revised effective date.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">9. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your privacy rights, contact us at:</p>
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

export default PrivacyPolicy;
