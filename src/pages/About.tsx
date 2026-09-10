import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, HeartPulse, Star, GripVertical, Activity, Info, Printer, Droplet, Stethoscope, ArrowLeft, CheckCircle2, Clock, Move, Zap, LayoutGrid, Smartphone, Volume2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CURRENT_VERSION = '1.4';

const versionHistory = [
  {
    version: '1.4',
    date: 'September 2026',
    label: 'Current Release',
    accent: 'from-blue-600 via-indigo-600 to-purple-600',
    textAccent: 'text-blue-600 dark:text-blue-400',
    bgAccent: 'bg-blue-50 dark:bg-blue-950/30',
    borderAccent: 'border-blue-200 dark:border-blue-800/50',
    updates: [
      {
        icon: Move,
        iconColor: 'text-sky-500',
        iconBg: 'bg-sky-500/15',
        title: 'VisionOS Floating Glass Dock (Freely Draggable)',
        desc: 'Sleek iOS/VisionOS-inspired floating mobile navigation bar that users can freely drag and reposition anywhere on screen. Automatically remembers coordinates across sessions.'
      },
      {
        icon: Zap,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-500/15',
        title: 'Zero-Lag Navigation & Borderless Dock',
        desc: 'Eliminated route-switching stutter with instantaneous micro-transitions. Removed bulky box outlines in favor of clean illuminated accent dots.'
      },
      {
        icon: LayoutGrid,
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-500/15',
        title: 'Ultra-Compact "All Modules" Launcher (Zero Scroll)',
        desc: 'Redesigned the quick modules bottom sheet into a streamlined 4-column compact grid that fits 100% on any mobile viewport with zero scrolling required.'
      },
      {
        icon: Smartphone,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-500/15',
        title: 'Ergonomic Top Header & Profile Swap',
        desc: 'Doctor avatar profile and quick settings relocated to the sticky mobile top header, reserving the bottom floating dock strictly for core clinical workflows.'
      },
      {
        icon: Volume2,
        iconColor: 'text-rose-500',
        iconBg: 'bg-rose-500/15',
        title: 'TV Queue Display Default Audio Chime',
        desc: 'Token calling chime now activates by default with automatic Web Audio context unlocking, paired with responsive layout support for TV, tablet, and mobile screens.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-500/15',
        title: 'Clinic Branding & Superadmin Security Isolation',
        desc: 'Clinic branding, name customization, and photo uploads are locked exclusively to clinic owners and doctors, preventing superadmin cross-clinic interference.'
      },
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
            onClick={() => navigate(slug ? `/${slug}/consultation` : '/')}
            className="gap-2 text-muted-foreground hover:text-foreground font-bold rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </motion.div>

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 text-white shadow-2xl shadow-blue-500/30"
        >
          {/* decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-white/5 rounded-full" />

          <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <HeartPulse className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Clinic Management</span>
              </div>
              <h1 className="text-4xl font-black tracking-tight">PreScripto</h1>
              <p className="text-blue-200 text-sm font-bold mt-1 max-w-sm leading-relaxed">
                A comprehensive clinical workflow platform for modern Indian outpatient practices.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-4 text-center min-w-[120px]">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Current Version</p>
              <p className="text-3xl font-black text-white">v{CURRENT_VERSION}</p>
              <div className="mt-1.5 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-300">Live</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Version Timeline */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">Version History</h2>

          <div className="space-y-4">
            {versionHistory.map((release, ri) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: ri * 0.07 }}
                className={cn(
                  'rounded-[1.5rem] border bg-card/80 backdrop-blur-sm overflow-hidden shadow-sm',
                  ri === 0 ? 'border-blue-200 dark:border-blue-800/60 shadow-blue-500/10 shadow-lg' : 'border-border'
                )}
              >
                {/* Version header */}
                <div className={cn('px-6 py-4 flex items-center justify-between', ri === 0 ? `bg-gradient-to-r ${release.accent} text-white` : 'bg-muted/30')}>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-2xl font-black', ri === 0 ? 'text-white' : release.textAccent)}>v{release.version}</span>
                    <div>
                      <span className={cn(
                        'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                        ri === 0 ? 'bg-white/20 text-white' : `${release.bgAccent} ${release.textAccent} border ${release.borderAccent}`
                      )}>{release.label}</span>
                    </div>
                  </div>
                  <span className={cn('text-xs font-bold', ri === 0 ? 'text-white/70' : 'text-muted-foreground')}>{release.date}</span>
                </div>

                {/* Updates list */}
                <div className="p-4 space-y-2">
                  {release.updates.map((update, ui) => (
                    <div key={ui} className={cn('flex gap-3 p-3 rounded-2xl border', ri === 0 ? `${release.bgAccent} ${release.borderAccent}` : 'bg-muted/20 border-border/50')}>
                      <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', ri === 0 ? (update.iconBg ?? 'bg-white/30') : release.bgAccent)}>
                        <update.icon className={cn('w-3.5 h-3.5', ri === 0 ? (update.iconColor ?? 'text-white') : release.textAccent)} />
                      </div>
                      <div>
                        <p className={cn('font-extrabold text-[12px]', ri === 0 ? 'text-slate-900 dark:text-slate-100' : 'text-foreground')}>{update.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{update.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center py-6 space-y-1"
        >
          <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]">PreScripto · GV Clinic · Cuddalore</p>
          <p className="text-[10px] text-muted-foreground/60">Built with ❤️ for modern Indian clinical practice</p>
        </motion.div>

      </div>
    </div>
  );
}
