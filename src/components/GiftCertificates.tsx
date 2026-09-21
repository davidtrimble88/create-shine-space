import { motion } from "framer-motion";
import { Gift, Phone } from "lucide-react";
import EditableText from "@/components/EditableText";

/**
 * Gift certificates are sold over the phone — there is no online product for
 * them — so this box exists to make the offer visible and hand the visitor the
 * office numbers. Placed straight after the courses so it reaches people at the
 * moment they have just read the prices.
 *
 * All copy goes through EditableText so the office can reword it in-app.
 */
const GiftCertificates = () => {
  return (
    <section className="py-16 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-card/80 backdrop-blur p-8 md:p-12">
            {/* Matches the accent glow used by the other highlight sections. */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Gift className="w-8 h-8 text-accent" />
              </div>

              <span className="text-accent font-semibold tracking-wider uppercase text-sm">
                <EditableText contentKey="gift.label" fallback="Gift Certificates" />
              </span>

              <h2 className="text-3xl md:text-5xl font-bold mt-4 mb-4">
                <EditableText contentKey="gift.title" fallback="Give the Gift of the Open Road" />
              </h2>

              <p className="text-xl md:text-2xl text-accent font-semibold mb-6">
                <EditableText
                  contentKey="gift.tagline"
                  fallback="Some gifts get unwrapped. This one gets ridden."
                />
              </p>

              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
                <EditableText
                  contentKey="gift.description"
                  fallback="Know someone who's always said they'd learn to ride one day? A Learn to Ride VC gift certificate turns someday into a date on the calendar — course, motorcycle and helmet included."
                  multiline
                />
              </p>

              <p className="text-base font-medium text-foreground mb-6">
                <EditableText
                  contentKey="gift.callout"
                  fallback="Gift certificates are purchased over the phone. Give the office a call and we'll set it up."
                  multiline
                />
              </p>

              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <motion.a
                  href="tel:+18058270075"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-4 bg-background/60 border border-border rounded-xl p-5 hover:border-accent/50 transition-all group"
                >
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      <EditableText contentKey="gift.vc.label" fallback="Ventura County" />
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      <EditableText contentKey="gift.vc.phone" fallback="(805) 827-0075" />
                    </p>
                  </div>
                </motion.a>

                <motion.a
                  href="tel:+17609876652"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="flex items-center gap-4 bg-background/60 border border-border rounded-xl p-5 hover:border-accent/50 transition-all group"
                >
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/20 transition-colors">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      <EditableText contentKey="gift.hd.label" fallback="High Desert" />
                    </p>
                    <p className="text-lg font-semibold text-foreground">
                      <EditableText contentKey="gift.hd.phone" fallback="(760) 987-6652" />
                    </p>
                  </div>
                </motion.a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default GiftCertificates;
