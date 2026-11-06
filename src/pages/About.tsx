import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, HeartPulse, Star, GripVertical, Activity, Info, Printer, 
  Droplet, Stethoscope, ArrowLeft, CheckCircle2, Clock, Move, Zap, 
  LayoutGrid, Smartphone, Volume2, ShieldCheck, Mail, Palette, FileSignature, BrainCircuit 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import aboutImg from '@/assets/About.png';

const CURRENT_VERSION = '1.5';

const versionHistory = [
  {
    version: '1.5',
    date: 'November 2026',
    label: 'AI Integration',
    accent: 'from-blue-600 via-indigo-600 to-purple-600',
    textAccent: 'text-blue-600 dark:text-blue-400',
    bgAccent: 'bg-blue-50 dark:bg-blue-950/30',
    borderAccent: 'border-blue-200 dark:border-blue-800/50',
    updates: [
      {
        icon: BrainCircuit,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-500/15',
        title: 'Nova Clinical AI Copilot (Built-in Assistant)',
        desc: 'All-new floating AI copilot integrated across the entire platform. Instant access to clinical calculations, drug interactions, disease guidance, and query logs with clinic-level analytics.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-500/15',
        title: 'Themes & Custom HEX Color Wheel Picker',
        desc: 'Brand personalization engine with live RGB/HEX palette wheel, preset themes (Dark, Light, System), and real-time illuminated glow across all buttons and active controls.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-500/15',
        title: 'Strict Multi-Clinic RBAC & Security Isolation',
        desc: 'Rigorous multi-tenant isolation guaranteeing clinic owner sovereignty over branding, logos, and letterheads. Platform admin accounts are strictly quarantined from individual clinic rosters.'
      },
      {
        icon: FileSignature,
        iconColor: 'text-blue-500',
        iconBg: 'bg-blue-500/15',
        title: 'Duty Doctor Dynamic Identity & NMC Digital Signature',
        desc: 'Automatic detection of the active consulting physician. Attending doctor qualifications, NMC registration number, and digital signature dynamically stamped on printed prescriptions.'
      },
      {
        icon: Move,
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-500/15',
        title: 'VisionOS Floating Glass Dock (Freely Draggable)',
        desc: 'Sleek iOS/VisionOS-inspired floating mobile navigation dock that users can freely drag and reposition anywhere on screen. Automatically remembers coordinates across sessions.'
      },
      {
        icon: Volume2,
        iconColor: 'text-rose-500',
        iconBg: 'bg-rose-500/15',
        title: 'TV Queue Display & Audio Calling Chime',
        desc: 'Real-time big-screen token display for patient waiting lounges with default Web Audio chime alerts and responsive layout across TV, tablet, and mobile.'
      },
      {
        icon: Printer,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-500/15',
        title: 'Pharmacy Print Queue Real-Time Spooler',
        desc: 'Dedicated dispensary print queue module with live WebSocket auto-refresh, silent printing triggers, and opulent A4 PDF layout rendering.'
      },
      {
        icon: Activity,
        iconColor: 'text-teal-500',
        iconBg: 'bg-teal-500/15',
        title: 'Predictive Clinical Intelligence & Analytics Engine',
        desc: 'Real-time patient flow dynamics, peak hour forecasting, demographic distributions, and diagnostic trend graphs.'
      },
      {
        icon: Smartphone,
        iconColor: 'text-cyan-500',
        iconBg: 'bg-cyan-500/15',
        title: 'Universal Responsive Engine & Seamless Visual Assets',
        desc: '100% fluid mobile, tablet, and desktop adaptation with unboxed, transparent high-resolution clinical illustrations.'
      }
    ]
  },
  {
    version: '1.4',
    date: 'September 2026',
    label: 'Feature Pack',
    accent: 'from-indigo-600 to-purple-600',
    textAccent: 'text-indigo-600 dark:text-indigo-400',
    bgAccent: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderAccent: 'border-indigo-200 dark:border-indigo-800/50',
    updates: [
      {
        icon: Move,
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-500/15',
        title: 'VisionOS Dock Optimization',
        desc: 'Initial prototype for floating navigation bar with session coordinate storage.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-500/15',
        title: 'Zero-Lag Navigation & Borderless Dock',
        desc: 'Eliminated route-switching stutter with instantaneous micro-transitions. Removed bulky box outlines.'
      },
      {
        icon: LayoutGrid,
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-500/15',
        title: 'Ultra-Compact All Modules Launcher',
        desc: 'Streamlined 4-column compact launcher grid fitting mobile viewports.'
      },
      {
        icon: Smartphone,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-500/15',
        title: 'Ergonomic Top Header & Profile Swap',
        desc: 'Doctor avatar profile relocated to sticky mobile top header.'
      }
    ]
  },
  {
    version: '1.3',
    date: 'July 2026',
    label: 'Previous Release',
    accent: 'from-violet-600 to-indigo-600',
    textAccent: 'text-violet-600 dark:text-violet-400',
    bgAccent: 'bg-violet-50 dark:bg-violet-950/30',
    borderAccent: 'border-violet-200 dark:border-violet-800/50',
    updates: [
      { icon: Info, iconColor: 'text-sky-500', iconBg: 'bg-sky-500/15', title: 'About & Version History', desc: 'Dedicated About page with full release notes and version changelog.' },
      { icon: Star, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/15', title: 'Consult Staff Feature Removed', desc: 'Streamlined the UI by removing the in-app staff call feature for a cleaner navigation experience.' },
      { icon: HeartPulse, iconColor: 'text-rose-500', iconBg: 'bg-rose-500/15', title: 'Vitals UI Cleanup', desc: 'Fixed the BP vitals icon and removed redundant call-to-staff buttons from the vitals section.' },
      { icon: CheckCircle2, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/15', title: 'Modern User Management', desc: 'Completely redesigned User Management form with glassmorphism styling, gradient accents, and smooth animations.' },
    ]
  },
  {
    version: '1.2',
    date: 'July 2026',
    label: 'Feature Pack',
    accent: 'from-violet-600 to-purple-600',
    textAccent: 'text-violet-600 dark:text-violet-400',
    bgAccent: 'bg-violet-50 dark:bg-violet-950/30',
    borderAccent: 'border-violet-200 dark:border-violet-800/50',
    updates: [
      { icon: GripVertical, title: 'Draggable Floating Canvas Toolbar', desc: 'Handwriting canvas toolbar is now a draggable floating card with large touch targets for tablets and styluses.' },
      { icon: Sparkles, title: 'Marching Ants Bounding Box', desc: 'Selected handwriting drawings now feature animated dashed outlines to clearly represent active selection.' },
      { icon: Clock, title: 'Patient Queue Wait Times', desc: 'Shows real-time waiting timers (e.g. "15m wait") directly in the patient queue sidebar.' },
      { icon: Info, title: 'Abnormal Vitals Warning Flags', desc: 'Flags high/low SpO₂ (<95%), high Temperature (>100.4°F), or abnormal BP for rapid triage support.' },
      { icon: Activity, title: 'Patient Vitals Trend Sparklines', desc: 'Inline SVG line charts inside vitals cells to visualize vital history trends over previous visits.' },
      { icon: Droplet, title: 'Visual Frequency Toggles', desc: 'Tap Morning/Afternoon/Night pill buttons to quickly fill standard medical shorthand (e.g. 1-0-1).' },
      { icon: Printer, title: 'Pre-printed Stationery Switcher', desc: 'Toggle branding headers off to print digital prescriptions directly onto physical letterhead pads.' },
    ]
  },
  {
    version: '1.1',
    date: 'June 2026',
    label: 'Major Architecture',
    accent: 'from-emerald-600 to-teal-600',
    textAccent: 'text-emerald-600 dark:text-emerald-400',
    bgAccent: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderAccent: 'border-emerald-200 dark:border-emerald-800/50',
    updates: [
      { icon: Stethoscope, title: 'Consultation Module Refactor', desc: 'Complete refactor into modular sub-components (QueuePanel, ConsultationForm, HistoryViewer) for improved performance and maintainability.' },
      { icon: Activity, title: 'Optimistic UI & Rollback', desc: 'Prescription saves now use optimistic UI updates with automatic rollback on network failure, eliminating stale data issues.' },
      { icon: Star, title: 'Diagnosis Tags System', desc: 'Multi-tag diagnosis input with history-based autocomplete for faster, accurate clinical documentation.' },
      { icon: CheckCircle2, title: 'Snippet Delete Buttons', desc: 'Added delete controls on every protocol/snippet entry so users can manage their personal snippet library.' },
    ]
  },
  {
    version: '1.0',
    date: 'May 2026',
    label: 'Initial Stable',
    accent: 'from-amber-500 to-orange-500',
    textAccent: 'text-amber-600 dark:text-amber-400',
    bgAccent: 'bg-amber-50 dark:bg-amber-950/30',
    borderAccent: 'border-amber-200 dark:border-amber-800/50',
    updates: [
      { icon: HeartPulse, title: 'Clinical Vitals Recording', desc: 'Staff can now record BP, Pulse, SpO₂, Temperature, Weight, and CBG directly during patient entry.' },
      { icon: Printer, title: 'Print Queue Module', desc: 'Dedicated print queue for reception staff to manage and print prescriptions without entering consultation.' },
      { icon: Star, title: 'Digital Handwriting Canvas', desc: 'Doctors can write prescriptions digitally using a stylus or finger with a multi-page canvas.' },
    ]
  },
];

export default function About() {
  const navigate = useNavigate();
  const { slug } = useParams();

  return (
    <div className="min-h-full relative">
      {/* Background atmospheric glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-30 dark:opacity-20">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500 blur-[180px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-violet-500 blur-[150px] rounded-full" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(slug ? `/${slug}/dashboard` : '/')}
            className="gap-2 text-muted-foreground hover:text-foreground font-bold rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </motion.div>

        {/* Minimal Professional Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative text-center space-y-4 pt-2 pb-4"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/10 blur-[80px] -z-10 rounded-full" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" /> A Product of Zevox
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
              About <span className="text-blue-600">PreScripto</span>
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto font-medium leading-relaxed">
              A comprehensive clinical workflow platform engineered for modern outpatient practices with zero-latency digital charting.
            </p>
          </div>

          {/* Seamless unboxed About Illustration */}
          <div className="flex justify-center pt-1 pb-1">
            <img
              src={aboutImg}
              alt="About PreScripto"
              className="h-28 sm:h-36 md:h-44 w-auto object-contain select-none pointer-events-none drop-shadow-sm"
            />
          </div>

          {/* Minimal Version Pill */}
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Release v{CURRENT_VERSION}
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-xs font-semibold text-muted-foreground">Production Stable</span>
          </div>
        </motion.div>

        {/* Expandable Version Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Version History & Changelog</h2>
            <span className="text-[10px] font-bold text-slate-400">Tap version to expand</span>
          </div>

          <Accordion type="multiple" defaultValue={['version-1.5']} className="w-full space-y-3.5">
            {versionHistory.map((release) => {
              const isCurrent = release.version === CURRENT_VERSION;
              return (
                <AccordionItem
                  key={release.version}
                  value={`version-${release.version}`}
                  className={cn(
                    'rounded-[1.5rem] border bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm transition-all',
                    isCurrent
                      ? 'border-blue-200 dark:border-blue-800/60 shadow-blue-500/10 shadow-lg'
                      : 'border-border'
                  )}
                >
                  <AccordionTrigger className={cn(
                    'px-6 py-4 flex items-center justify-between hover:no-underline transition-colors group',
                    isCurrent ? `bg-gradient-to-r ${release.accent} text-white` : 'bg-muted/30 hover:bg-muted/50'
                  )}>
                    <div className="flex items-center gap-3 text-left">
                      <span className={cn('text-2xl font-black tracking-tight', isCurrent ? 'text-white' : release.textAccent)}>
                        v{release.version}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full',
                          isCurrent
                            ? 'bg-white/20 text-white'
                            : `${release.bgAccent} ${release.textAccent} border ${release.borderAccent}`
                        )}>
                          {release.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900 shadow-xs">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={cn('text-xs font-bold mr-2 shrink-0', isCurrent ? 'text-white/80' : 'text-muted-foreground')}>
                      {release.date}
                    </span>
                  </AccordionTrigger>

                  <AccordionContent className="p-4 space-y-2.5 border-t border-border/40">
                    {release.updates.map((update, ui) => (
                      <div
                        key={ui}
                        className={cn(
                          'flex gap-3.5 p-3.5 rounded-2xl border transition-all',
                          isCurrent ? `${release.bgAccent} ${release.borderAccent}` : 'bg-muted/20 border-border/50'
                        )}
                      >
                        <div className={cn('p-2 rounded-xl shrink-0 mt-0.5', isCurrent ? (update.iconBg ?? 'bg-white/30') : release.bgAccent)}>
                          <update.icon className={cn('w-4 h-4', isCurrent ? (update.iconColor ?? 'text-white') : release.textAccent)} />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <p className={cn('font-black text-xs', isCurrent ? 'text-slate-900 dark:text-slate-100' : 'text-foreground')}>
                              {update.title}
                            </p>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-blue-600 text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">{update.desc}</p>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-6 space-y-2 border-t border-border/50"
        >
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">PreScripto by Zevox · Enterprise Clinical Systems</p>
          <p className="text-[10px] text-muted-foreground/80 font-medium">Built with precision for healthcare practitioners</p>
          <div className="pt-2 flex items-center justify-center">
            <a
              href="mailto:contact.zevox@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors shadow-xs"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>contact.zevox@gmail.com</span>
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
