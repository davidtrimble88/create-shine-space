import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Shield, Users, Heart, MapPin, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import EditableText from "@/components/EditableText";
import award2015 from "@/assets/about-award-2015.jpg";
import award2016 from "@/assets/about-award-2016.jpg";
import larryImg from "@/assets/about-larry.jpg";

const stats = [
  { value: "1,500+", label: "Students Trained Yearly" },
  { value: "10+", label: "Years of Excellence" },
  { value: "2", label: "Training Locations" },
  { value: "100%", label: "Dedication to Safety" },
];

const About = () => {
  const [instructors, setInstructors] = useState<any[]>([]);

  useEffect(() => {
    const fetchInstructors = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, position, photo_url, bio, photo_position_x, photo_position_y, photo_zoom")
        .eq("show_on_website", true)
        .eq("is_active", true)
        .order("created_at");
      setInstructors(data ?? []);
    };
    fetchInstructors();
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">
              <EditableText contentKey="about.hero.label" fallback="About Us" />
            </span>
            <h1 className="text-5xl md:text-6xl font-bold mt-4 mb-6">
              <EditableText contentKey="about.hero.title" fallback="Your Safety Is Our Business" />
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl leading-relaxed">
              <EditableText contentKey="about.hero.description" fallback="Learn To Ride VC was created to get you trained and on the road with the skills to survive the ride. We take your safety seriously." multiline />
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-accent">{stat.value}</p>
                <p className="text-muted-foreground text-sm mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="text-accent font-semibold tracking-wider uppercase text-sm">
                <EditableText contentKey="about.mission.label" fallback="Our Mission" />
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-6">
                <EditableText contentKey="about.mission.title.a" fallback="More Than a School —" />{" "}
                <span className="text-accent"><EditableText contentKey="about.mission.title.b" fallback="Your Lifelong Riding Partner" /></span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                <EditableText contentKey="about.mission.p1" fallback="Whether you're a new motorcyclist looking to get your license, or an experienced rider brushing up on skills or getting comfortable on a new bike — we have a course for you." multiline />
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                <EditableText contentKey="about.mission.p2" fallback="Your successful completion of the basic Motorcyclist Training Course (MTC) may waive the California DMV skills test for anyone 18 years of age and over. This course is a requirement for anyone under 21." multiline />
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  CHP Authorized
                </div>
                <div className="flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                  <Award className="w-4 h-4" />
                  CMSP Certified
                </div>
                <div className="flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-medium">
                  <MapPin className="w-4 h-4" />
                  2 Locations
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              {[
                {
                  icon: Shield,
                  title: "DMV Skills Test Waiver",
                  desc: "Complete our course and skip the DMV riding test. Walk out ready for your license.",
                },
                {
                  icon: Users,
                  title: "Expert CMSP Instructors",
                  desc: "Our certified professionals have the knowledge, skill, and patience to guide you through training.",
                },
                {
                  icon: Heart,
                  title: "Ongoing Support",
                  desc: "We encourage all students to stay in contact for resources and information to grow as safe motorcyclists.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex gap-5 p-6 rounded-2xl bg-card border border-border hover:border-accent/30 transition-colors"
                >
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      <EditableText contentKey={`about.feature.${i}.title`} fallback={item.title} />
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      <EditableText contentKey={`about.feature.${i}.desc`} fallback={item.desc} multiline />
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Awards Section */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">
              <EditableText contentKey="about.awards.label" fallback="Recognition" />
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4">
              <EditableText contentKey="about.awards.title.a" fallback="Award-Winning" /> <span className="text-accent"><EditableText contentKey="about.awards.title.b" fallback="Excellence" /></span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border mb-6">
                <img
                  src={award2015}
                  alt="2015 Best Outreach Award for Service Excellence"
                  className="w-full h-72 object-contain group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-semibold">
                    2015
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                <EditableText contentKey="about.award1.title" fallback="Best Outreach Award" />
              </h3>
              <p className="text-muted-foreground">
                <EditableText contentKey="about.award1.desc" fallback="Awarded for Service Excellence to Learn To Ride VC by the California Motorcyclist Safety Program." multiline />
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border mb-6">
                <img
                  src={award2016}
                  alt="2016 Ambassador of the Year Award"
                  className="w-full h-72 object-contain group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-semibold">
                    2016
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Ambassador of the Year</h3>
              <p className="text-muted-foreground">
                Awarded for Service Excellence to Larry Missman, recognizing outstanding
                dedication to motorcycle safety education.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Meet the Owner */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={larryImg}
                  alt="Larry Missman - Owner of Learn to Ride VC"
                  className="w-full h-[500px] object-contain object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground px-6 py-3 rounded-xl font-bold text-lg shadow-glow">
                Owner & Lead Instructor
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="text-accent font-semibold tracking-wider uppercase text-sm">
                Meet the Owner
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mt-4 mb-6">
                Larry <span className="text-accent">Missman</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                <EditableText contentKey="about.larry.p1" fallback="Larry Missman has been a motorcycle enthusiast since the age of ten. From a 50cc Honda to sport bikes to Harleys, he has ridden them all throughout his life." multiline />
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                <EditableText contentKey="about.larry.p2" fallback="As a public speaker for riders in his community and an advocate for safety, Larry decided to pursue a career in motorcycle training. Having taught thousands of students, his dedication and passion for teaching led him to attain ownership of Learn To Ride VC." multiline />
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                <EditableText contentKey="about.larry.p3" fallback="You are in excellent hands when you sign up with us. From the moment you call, we will be here to help you!" multiline />
              </p>
              <Button variant="hero" size="lg" asChild>
                <Link to="/contact">
                  Get in Touch <ChevronRight className="w-4 h-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Meet the Instructors */}
      <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-accent font-semibold tracking-wider uppercase text-sm">
              Our Team
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mt-4">
              Meet the <span className="text-accent">Team</span>
            </h2>
            <p className="text-muted-foreground text-lg mt-4 max-w-2xl mx-auto">
              Our CMSP-certified team brings years of riding experience and a
              passion for safety to every class.
            </p>
          </motion.div>

          {instructors.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {instructors.map((instructor, i) => (
                <motion.div
                  key={instructor.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="group text-center"
                >
                  <div className="relative overflow-hidden rounded-2xl border border-border mb-5">
                    {instructor.photo_url ? (
                      <img
                        src={instructor.photo_url}
                        alt={instructor.full_name}
                        className="w-full h-72 group-hover:scale-105 transition-transform duration-500"
                         style={{
                           objectFit: "cover",
                           objectPosition: `${instructor.photo_position_x ?? 50}% ${instructor.photo_position_y ?? 50}%`,
                           transform: `scale(${(instructor.photo_zoom ?? 100) / 100})`,
                           transformOrigin: `${instructor.photo_position_x ?? 50}% ${instructor.photo_position_y ?? 50}%`,
                         }}
                      />
                    ) : (
                      <div className="w-full h-72 bg-muted flex items-center justify-center">
                        <Users className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{instructor.full_name}</h3>
                  <p className="text-accent font-medium text-sm mt-1">{instructor.position || "Instructor"}</p>
                  {instructor.bio && (
                    <p className="text-muted-foreground text-sm mt-3 leading-relaxed">
                      {instructor.bio}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Our instructor profiles are coming soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-card border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to <span className="text-accent">Ride?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Join over 1,500 students who train with us every year. Your journey
              starts here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="lg">
                Book a Course
              </Button>
              <Button variant="heroOutline" size="lg" asChild>
                <Link to="/">
                  Back to Home
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
