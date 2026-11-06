import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Info, HelpCircle, LogIn, ClipboardPlus, Stethoscope, Printer,
  BarChart3, UserCog, Zap, Sparkles, ShieldCheck, Smartphone,
  Database, RefreshCw, PenTool, Activity, BrainCircuit, Palette,
  FileSignature, Volume2, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import helpImg from '@/assets/Help.png';

export default function Help() {
  const features = [
    {
      title: "Nova AI Clinical Assistant",
      desc: "Floating intelligent assistant for medical formula checks, drug interaction queries, and diagnostic protocol references.",
      icon: <BrainCircuit className="w-6 h-6 text-blue-500" />,
      color: "bg-blue-50 dark:bg-blue-950/30"
    },
    {
      title: "Duty Doctor Digital Signature",
      desc: "Automatic detection of the consulting physician with dynamic stamp of qualifications, NMC registration ID, and digital signature.",
      icon: <FileSignature className="w-6 h-6 text-indigo-500" />,
      color: "bg-indigo-50 dark:bg-indigo-950/30"
    },
    {
      title: "Custom Accent Color Engine",
      desc: "Universal color wheel palette & HEX picker allowing each user and clinic to choose their signature brand accent color.",
      icon: <Palette className="w-6 h-6 text-purple-500" />,
      color: "bg-purple-50 dark:bg-purple-950/30"
    },
    {
      title: "Digital Prescription Pad (iPad/Pen)",
      desc: "Write prescriptions naturally using iPad & Apple Pencil. Zero-latency digital ink for an opulent, pressure-sensitive feel.",
      icon: <PenTool className="w-6 h-6 text-emerald-500" />,
      color: "bg-emerald-50 dark:bg-emerald-950/30"
    },
    {
      title: "TV Waiting Queue Display",
      desc: "Dedicated big-screen token display with default audio chimes and responsive layouts for outpatient waiting areas.",
      icon: <Volume2 className="w-6 h-6 text-amber-500" />,
      color: "bg-amber-50 dark:bg-amber-950/30"
    },
    {
      title: "Pharmacy Print Spooler",
      desc: "Real-time dispatch queue for clinical dispensary staff to spool and print official A4 prescriptions without delay.",
      icon: <Printer className="w-6 h-6 text-rose-500" />,
      color: "bg-rose-50 dark:bg-rose-950/30"
    },
    {
      title: "Predictive Analytics",
      desc: "Real-time insights into patient flow dynamics, peak hour loads, common diagnoses, and clinic growth trends.",
      icon: <BarChart3 className="w-6 h-6 text-sky-500" />,
      color: "bg-sky-50 dark:bg-sky-950/30"
    },
    {
      title: "Multi-Clinic RBAC Isolation",
      desc: "Airtight tenant isolation guaranteeing clinic owner sovereignty over branding, letterheads, and staff access rosters.",
      icon: <ShieldCheck className="w-6 h-6 text-slate-700 dark:text-slate-300" />,
      color: "bg-slate-50 dark:bg-slate-800/50"
    }
  ];

  const faqSections = [
    {
      title: "Nova Clinical AI Assistant",
      icon: <BrainCircuit className="w-5 h-5 text-blue-500" />,
      questions: [
        {
          q: "What is Nova AI and how do I open it?",
          a: "Nova is your built-in clinical intelligence copilot. Click the floating 'Nova' pill button in the bottom right corner of any page to open the interactive assistant panel."
        },
        {
          q: "Can Nova help with medical calculations and drug queries?",
          a: "Yes. You can ask Nova about standard pediatric dosing formulas, adult posology, contraindicated drug combinations, and standard clinical guidance protocols."
        },
        {
          q: "Is patient consultation data kept secure with Nova?",
          a: "Yes. Nova runs in a quarantined sandbox with strict context limits, ensuring clinical discussions adhere to healthcare data privacy protocols."
        }
      ]
    },
    {
      title: "Themes, Colors & Appearance",
      icon: <Palette className="w-5 h-5 text-purple-500" />,
      questions: [
        {
          q: "How do I change the app theme or brand accent color?",
          a: "Navigate to Settings → 'Themes & Appearance'. You can select Light Mode, Dark Mode, or System Auto. You can also pick from curated presets or use the Custom Color Picker (with color wheel or HEX code) to set your favorite brand color."
        },
        {
          q: "Does changing my theme affect other clinic staff?",
          a: "Device themes (Dark/Light and custom accent color) are saved specifically to your active browser session so every doctor and nurse can work in their preferred lighting without affecting others."
        }
      ]
    },
    {
      title: "Doctor Signature & Prescription Branding",
      icon: <FileSignature className="w-5 h-5 text-indigo-500" />,
      questions: [
        {
          q: "How do I configure my digital signature and NMC Registration ID?",
          a: "Go to your 'Doctor Profile' page and select the 'Doctor Settings' tab. Enter your full name, qualifications (e.g. MBBS, MD), NMC registration number, and draw your digital signature on the digital seal canvas. Hit 'Save Credentials' to activate."
        },
        {
          q: "Which doctor's name appears on the printed prescription?",
          a: "When writing a prescription, the system automatically binds the attending duty doctor's credentials and digital signature seal to that specific visit record."
        },
        {
          q: "Who can change the clinic name, address, and letterhead logo?",
          a: "Only the verified Clinic Owner has administrative rights to configure clinic legal name, address, emergency phone number, and prescription letterhead layout under 'Settings'."
        }
      ]
    },
    {
      title: "TV Waiting Display & Audio Alerts",
      icon: <Volume2 className="w-5 h-5 text-amber-500" />,
      questions: [
        {
          q: "How do I open the patient waiting room TV display?",
          a: "In your browser, visit the URL '/:clinic-slug/display' or select 'TV Display' from the quick launcher menu. Full-screen the window on your patient lounge monitor or Smart TV."
        },
        {
          q: "Does the TV display make a sound when a patient is called?",
          a: "Yes! PreScripto includes a built-in Web Audio chime alert that automatically rings through the TV speakers whenever a doctor summons the next patient."
        }
      ]
    },
    {
      title: "Patient Entry & Vitals (For Staff)",
      icon: <ClipboardPlus className="w-5 h-5 text-emerald-500" />,
      questions: [
        {
          q: "How do I register a new patient and issue a token?",
          a: "Open the 'Patient Entry' tab, click 'New Patient', enter Name, Age, and Contact Number. You can optionally record vitals (BP, Pulse, SpO2, Temp, Weight, CBG) and assign an attending doctor before printing the token."
        },
        {
          q: "Do patient vitals sync to the doctor in real-time?",
          a: "Yes. Once submitted, patient vitals appear instantly on the doctor's consultation queue with automatic triage flags for abnormal vitals (e.g. high fever or abnormal BP)."
        }
      ]
    },
    {
      title: "Pharmacy Print Queue (For Dispensary)",
      icon: <Printer className="w-5 h-5 text-rose-500" />,
      questions: [
        {
          q: "How does the Pharmacy Print Queue work?",
          a: "When a doctor finishes charting and clicks 'Save Prescription', the print job immediately lands in the 'Print Queue' tab. Pharmacy or front desk staff can review and print in one click."
        },
        {
          q: "Can prescriptions be printed on pre-printed clinic letterheads?",
          a: "Yes. The clinic owner can toggle pre-printed stationery mode in 'Settings' → 'Prescription Layout', which hides the header text so content prints directly onto your physical letterhead."
        }
      ]
    },
    {
      title: "Roles & Access Governance",
      icon: <Crown className="w-5 h-5 text-amber-600" />,
      questions: [
        {
          q: "What roles exist in PreScripto?",
          a: "There are three core clinic roles: Clinic Owner (full administrative control over clinic info, branding, templates, and staff accounts), Doctor (consultations, clinical charting, digital signatures), and Staff (patient registration, triage vitals, and print queue management)."
        },
        {
          q: "Are superadmin accounts visible in my clinic team roster?",
          a: "No. PreScripto uses strict multi-tenant security isolation. Platform administrator accounts are quarantined from individual clinic directories, ensuring only your clinic's registered owner, doctors, and nurses are displayed."
        }
      ]
    }
  ];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-16 animate-in fade-in duration-700 pb-20">

      {/* Hero Section */}
      <div className="text-center space-y-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/10 blur-[80px] -z-10 rounded-full" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 mb-2">
          <Zap className="w-3 h-3" /> System Guide & Features
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-800 dark:text-slate-100 leading-tight">
          Modernizing <span className="text-blue-600">PreScripto</span>
        </h1>
        <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto font-medium">
          A high-performance digital healthcare platform optimized for premium patient care and efficient management.
        </p>

        {/* Waving Customer Support Doodle at the top 👋 */}
        <div className="flex justify-center pt-2">
          <img
            src={helpImg}
            alt="Help & System Guide"
            className="h-28 sm:h-36 md:h-44 w-auto object-contain select-none pointer-events-none drop-shadow-sm"
          />
        </div>
      </div>

      {/* Salient Features Section */}
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl font-black tracking-tight dark:text-slate-100">Salient Features</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="border-none shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 bg-white dark:bg-slate-900 overflow-hidden group">
              <CardContent className="p-8 space-y-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 ${f.color}`}>
                  {f.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                    {f.desc}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="grid lg:grid-cols-3 gap-12 pt-8 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl w-fit shadow-lg shadow-blue-200 dark:shadow-none">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-black tracking-tight dark:text-slate-100">Common Questions</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Everything you need to know about operating the Prescripto platform. Can't find an answer? Contact support below.
          </p>

          <div className="pt-6 space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-2">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Official Support Email</p>
              <a
                href="mailto:contact.zevox@gmail.com"
                className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 hover:underline block break-all"
              >
                contact.zevox@gmail.com
              </a>
              <p className="text-xs text-muted-foreground font-medium">Available 24/7 for clinic onboarding & technical assist</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqSections.map((section, idx) => (
              <AccordionItem
                key={idx}
                value={`section-${idx}`}
                className="border-none rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden px-6"
              >
                <AccordionTrigger className="hover:no-underline py-5 group">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                      {section.icon}
                    </div>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-lg tracking-tight">
                      {section.title}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8 space-y-6 border-t border-slate-50 dark:border-slate-800 pt-6">
                  {section.questions.map((item, qIdx) => (
                    <div key={qIdx} className="space-y-2">
                      <p className="font-black text-slate-800 dark:text-slate-100 text-sm flex items-start gap-2">
                        <span className="text-blue-600">Q:</span>
                        {item.q}
                      </p>
                      <p className="text-muted-foreground text-[13px] leading-relaxed pl-6 font-medium">
                        {item.a}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center pt-10">
        <p className="text-[10px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.5em]">
          Prescripto Healthcare — Opulent Digital Solutions
        </p>
      </div>

    </div>
  );
}
