import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  gender: z.enum(["male", "female", "other"], { required_error: "Please select your gender" }),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phone: z.string().trim().min(7, "Valid phone number required").max(20),
  email: z.string().trim().email("Valid email required").max(255),
  address: z.string().trim().min(1, "Address is required").max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(1, "State is required").max(50),
  zip: z.string().trim().min(5, "Valid ZIP code required").max(10),
  licenseNumber: z.string().trim().min(1, "Driver license number is required").max(50),
  issuingCountry: z.string().trim().min(1, "Issuing country is required").max(50),
  issuingState: z.string().trim().min(1, "Issuing state is required").max(50),
  licenseExpiration: z.string().min(1, "License expiration date is required"),
  referralSource: z.string().min(1, "Please select how you found us"),
  referralSource: z.string().min(1, "Please select how you found us"),
  agreement: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms to continue" }),
  }),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

const referralOptions = [
  "Google",
  "Learn To Ride VC Website",
  "Yelp",
  "Facebook",
  "Instagram",
  "Chopperfest",
  "Cal Coast Motorsports",
  "Word of Mouth / Friend",
  "DMV",
  "CHP",
  "Cycle Gear",
  "Ventura Fair",
  "Ventura Harley Davidson",
  "Thousand Oaks Powersports",
  "Santa Barbara Motorsports",
  "My Garage Ventura",
  "The Shop Ventura",
  "BBB (Better Business Bureau)",
  "Overland Outdoor Expo",
  "Other",
];

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const course = searchParams.get("course") || "basic";
  const location = searchParams.get("location") || "ventura-county";
  const schedule = searchParams.get("schedule") || "";

  const courseLabels: Record<string, string> = {
    basic: "Basic Riding Course",
    intermediate: "Intermediate Course",
    advanced: "Advanced Riding Clinic",
  };

  const locationLabels: Record<string, string> = {
    "high-desert": "High Desert — Hesperia",
    "ventura-county": "Ventura County — Somis",
  };

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      licenseNumber: "",
      issuingCountry: "US",
      issuingState: "",
      licenseExpiration: "",
      referralSource: "",
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    console.log("Registration submitted:", data);
    toast({
      title: "Registration Submitted!",
      description: "We'll contact you shortly to confirm your reservation and arrange payment.",
    });
  };

  const dateOfBirth = form.watch("dateOfBirth");

  const age = dateOfBirth
    ? (() => {
        const today = new Date();
        const birth = new Date(dateOfBirth);
        let a = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
        return a;
      })()
    : null;

  const isUnder21 = age !== null && age < 21;
  const fee = isUnder21 ? "$395" : "$425";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-32 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <span className="inline-block bg-accent/20 text-accent font-bold px-4 py-2 rounded-full text-sm mb-6 border border-accent/30">
              Step 4 of 4
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Student <span className="text-accent">Registration</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              Complete the form below to reserve your spot.
            </p>
            <p className="text-sm text-muted-foreground">
              {courseLabels[course] || course} · {locationLabels[location] || location}
              {schedule && ` · ${schedule}`}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl mx-auto"
          >
            {/* Notice */}
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 mb-8 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Important</p>
              <p>
                After submitting, please contact our office at{" "}
                <a href="tel:+18058270075" className="text-accent font-medium hover:underline">
                  (805) 827-0075
                </a>{" "}
                to secure your reservation with payment. Reservations not secured within 24 hours will be canceled.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Personal Information */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex gap-6 mt-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="male" id="male" />
                                <Label htmlFor="male">Male</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="female" id="female" />
                                <Label htmlFor="female">Female</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="other" id="other" />
                                <Label htmlFor="other">Other</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Address</h2>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="Los Angeles" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State *</FormLabel>
                            <FormControl>
                              <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zip"
                        render={({ field }) => (
                          <FormItem className="col-span-2 md:col-span-1">
                            <FormLabel>ZIP *</FormLabel>
                            <FormControl>
                              <Input placeholder="90001" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Driver License */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Driver License</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Number *</FormLabel>
                          <FormControl>
                            <Input placeholder="D1234567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="licenseExpiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiration Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="issuingCountry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issuing Country *</FormLabel>
                          <FormControl>
                            <Input placeholder="US" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="issuingState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issuing State *</FormLabel>
                          <FormControl>
                            <Input placeholder="CA" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Fee & Referral */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-bold text-foreground mb-6">Fee & Additional Info</h2>

                  <FormField
                    control={form.control}
                    name="ageGroup"
                    render={({ field }) => (
                      <FormItem className="mb-6">
                        <FormLabel>Age Group *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex gap-6 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="21-and-over" id="21-and-over" />
                              <Label htmlFor="21-and-over">21 and over — $425</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="under-21" id="under-21" />
                              <Label htmlFor="under-21">Under 21 — $395</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedAgeGroup && (
                    <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 mb-6 text-center">
                      <span className="text-sm text-muted-foreground">Course Fee: </span>
                      <span className="text-lg font-bold text-accent">{fee}</span>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="referralSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>How did you find us? *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select one..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {referralOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Agreement */}
                <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
                  <FormField
                    control={form.control}
                    name="agreement"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm leading-relaxed">
                            I have read, understand, and agree to the Gear Requirements and Return Policy located in the Student Info page. I also attest that I am not in possession of a restricted license due to one or more convictions for driving while impaired. I understand that I will need to call the office to secure my spot in the class with payment by the next business day. Rescheduling and refunds are not available once the seat has been paid. *
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="text-center">
                  <Button type="submit" variant="hero" size="lg" className="px-12">
                    Submit Registration
                  </Button>
                </div>
              </form>
            </Form>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default RegisterPage;
