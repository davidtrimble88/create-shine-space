import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Benefits from "@/components/Benefits";
import Courses from "@/components/Courses";
import Locations from "@/components/Locations";
import Testimonials from "@/components/Testimonials";
import ContactCTA from "@/components/ContactCTA";
import Footer from "@/components/Footer";
import Seo, { SITE_URL } from "@/components/Seo";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Learn to Ride VC",
  url: SITE_URL,
  email: "office@learntoridevc.com",
  description:
    "CMSP-certified motorcycle training in Ventura County and the High Desert, California.",
  sameAs: [
    "https://www.instagram.com/learntoridevc",
    "https://www.facebook.com/learntoridevc",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      telephone: "+1-805-827-0075",
      contactType: "customer service",
      areaServed: "US-CA",
      availableLanguage: "English",
    },
    {
      "@type": "ContactPoint",
      telephone: "+1-760-987-6652",
      contactType: "customer service",
      areaServed: "US-CA",
      availableLanguage: "English",
    },
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Learn to Ride VC",
  url: SITE_URL,
};

const venturaSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Learn to Ride VC — Ventura County",
  url: SITE_URL,
  telephone: "+1-805-827-0075",
  email: "office@learntoridevc.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Somis",
    addressRegion: "CA",
    addressCountry: "US",
  },
  areaServed: "Ventura County, California",
};

const highDesertSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Learn to Ride VC — High Desert",
  url: SITE_URL,
  telephone: "+1-760-987-6652",
  email: "office@learntoridevc.com",
  priceRange: "$$",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Hesperia",
    addressRegion: "CA",
    addressCountry: "US",
  },
  areaServed: "High Desert, California",
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Motorcycle Training in Ventura & High Desert | Learn to Ride VC"
        description="CMSP-certified motorcycle training in Ventura County and the High Desert. Bike & helmet provided, DMV skills-test waiver on completion. Book your class today."
        path="/"
        jsonLd={[organizationSchema, websiteSchema, venturaSchema, highDesertSchema]}
      />
      <Navbar />
      <Hero />
      <Benefits />
      <Courses />
      <Locations />
      <Testimonials />
      <ContactCTA />
      <Footer />
    </div>
  );
};

export default Index;
