import { useAuth } from '@/lib/auth';
import { useNavigate, useParams, useOutletContext, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  ClipboardPlus, Stethoscope, Printer, Users, Activity,
  ArrowUpRight, UserPlus, CheckCircle2, Tv, Sparkles, Clock
} from 'lucide-react';
import { useEffect } from 'react';
import { startOfDay, endOfDay } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

// Mini circular arc gauge matching Skynex sub-cards
function MiniArcGauge({ percent, color }: { percent: number; color: string }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(10, percent)) / 100) * circumference;

  return (
    <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, roles, hasRole } = useAuth();
  const { slug } = useParams();
  const { clinic } = useOutletContext<{ clinic: any }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const isSuperAdmin = roles.includes('superadmin') || hasRole('superadmin') || (profile as any)?.is_superadmin;
    const isOwner = Boolean(clinic?.owner_id && user?.id && clinic.owner_id === user.id);
    
    // Superadmins and clinic owners have full multi-clinic authority
    if (!isSuperAdmin && !isOwner && profile && (profile as any).clinic_id && clinic?.id && (profile as any).clinic_id !== clinic.id) {
      toast.error("Account Mismatch: You are viewing " + clinic.name + " but your account is assigned to another clinic.");
    }
  }, [profile, clinic?.id, clinic?.name, clinic?.owner_id, user?.id, roles, hasRole]);

  const { data: dashboardData = { stats: { total: 0, today: 0, completed: 0, waiting: 0, inCabin: 0 }, completedList: [] } } = useQuery({
    queryKey: ['dashboardData', clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { stats: { total: 0, today: 0, completed: 0, waiting: 0, inCabin: 0 }, completedList: [] };
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      const [totalPatients, totalVisitsToday, completedToday, waitingToday, inCabinToday, completedListData] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'waiting'),
        supabase.from('visits').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'in_consultation'),
        supabase.from('visits').select('id, token_number, patients(title, name)').eq('clinic_id', clinic.id).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed').order('updated_at', { ascending: false }).limit(4)
      ]);

      return {
        stats: {
          total: totalPatients.count || 0,
          today: totalVisitsToday.count || 0,
          completed: completedToday.count || 0,
          waiting: waitingToday.count || 0,
          inCabin: inCabinToday.count || 0
        },
        completedList: completedListData.data || []
      };
    },
    staleTime: 5000,
  });

  const stats = dashboardData.stats;
  const completedList = dashboardData.completedList;

  // Realtime updates
  useEffect(() => {
    if (!clinic?.id) return;

    let debounceTimer: any;
    const channel = supabase
      .channel(`dashboard-realtime-${clinic.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'visits'
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic.id] });
        }, 500);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients'
      }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboardData', clinic.id] });
        }, 500);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, clinic?.id]);

  // Operational Modules
  const operations = [
    { label: 'Patient Entry', desc: 'Register & vitals', icon: ClipboardPlus, path: '../nurse', roles: ['staff', 'doctor'] as const, color: 'text-blue-500 bg-blue-500/10' },
    { label: 'Consultation', desc: 'Active queue & Rx', icon: Stethoscope, path: '../consultation', roles: ['doctor'] as const, color: 'text-indigo-500 bg-indigo-500/10' },
    { label: 'Print Queue', desc: 'Instant printouts', icon: Printer, path: '../print', roles: ['staff', 'doctor'] as const, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'TV Display', desc: 'Waiting room screen', icon: Tv, path: '../display', roles: ['doctor', 'staff'] as const, color: 'text-emerald-500 bg-emerald-500/10' },
  ];

  const visibleOps = operations.filter(m => m.roles.some(r => hasRole(r)));

  // Calculate metrics
  const todayVisits = stats.today;
  const completedVisits = stats.completed;
  const waitingVisits = stats.waiting;
  const inCabinVisits = stats.inCabin;

  const completionPercent = todayVisits > 0
    ? Math.round((completedVisits / todayVisits) * 100)
    : (stats.total > 0 ? 82 : 0);

  const progressRatio = todayVisits > 0
    ? (completedVisits / todayVisits)
    : (completionPercent / 100);

  const totalSegments = 34;
  const activeSegments = Math.round(progressRatio * totalSegments);

  return (
    <div className="space-y-6 max-w-4xl mx-auto font-jakarta-sans">
      {/* ── Greeting Header (Matches Skynex Typography) ── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
            Hey, Hi! {(profile?.full_name ?? 'Doctor')} 👋
          </p>
          <div className="mt-1">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Healthy <span className="font-serif italic font-normal text-primary">Clinic</span>
            </h1>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Starts
            </h2>
          </div>
        </div>

        {/* Live Indicator Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 shadow-xs">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] font-extrabold tracking-wider uppercase text-slate-600 dark:text-slate-300">Live Practice</span>
        </div>
      </div>

      {/* ── Primary Hero Glass Card (Matches Skynex Main Card) ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-[2rem] p-5 sm:p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/80 dark:border-slate-800/80 shadow-xl shadow-primary/5 space-y-5"
      >
        {/* Card Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shadow-xs">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">Your Clinic Flow</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Live Queue • Today</p>
            </div>
          </div>

          <button
            onClick={() => navigate('../consultation')}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all active:scale-90"
            title="Open Consultation"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Big Stat & Status Row */}
        <div className="flex items-end justify-between pt-1">
          <div>
            <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
              {completionPercent}%
            </div>
            <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">Completion Rate</p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{waitingVisits > 0 ? 'Active Flow' : 'Optimal'}</span>
          </div>
        </div>

        {/* Segmented Track Bar (Thin vertical pill bars like Skynex) */}
        <div className="flex items-center justify-between gap-1 sm:gap-1.5 pt-1 overflow-hidden">
          {Array.from({ length: totalSegments }).map((_, idx) => {
            const isActive = idx < activeSegments;
            return (
              <div
                key={idx}
                className={cn(
                  "flex-1 h-6 sm:h-7 rounded-full transition-all duration-500",
                  isActive
                    ? "bg-primary shadow-[0_0_8px_var(--accent-glow)]"
                    : "bg-slate-200/80 dark:bg-slate-800/80"
                )}
              />
            );
          })}
        </div>

        {/* ── 2x2 Compact Metric Grid (Sub-cards like Skynex) ── */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Waiting */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Waiting</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{waitingVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">In Queue</p>
            </div>
            <MiniArcGauge
              percent={todayVisits > 0 ? (waitingVisits / todayVisits) * 100 : 35}
              color="hsl(var(--primary))"
            />
          </div>

          {/* In Cabin */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">In Cabin</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{inCabinVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Active</p>
            </div>
            <MiniArcGauge
              percent={inCabinVisits > 0 ? 100 : 20}
              color="#f43f5e"
            />
          </div>

          {/* Completed */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Completed</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{completedVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Prescribed</p>
            </div>
            <MiniArcGauge
              percent={completionPercent}
              color="#8b5cf6"
            />
          </div>

          {/* Total Today */}
          <div className="bg-white/90 dark:bg-slate-800/90 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Registered</p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">{todayVisits}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">Total Visits</p>
            </div>
            <MiniArcGauge
              percent={todayVisits > 0 ? 80 : 25}
              color="#10b981"
            />
          </div>
        </div>

        {/* Floating Quick Entry Button (Bottom Right) */}
        <button
          onClick={() => navigate('../nurse')}
          className="absolute -bottom-3 right-5 sm:right-6 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-bold text-xs shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>New Patient</span>
        </button>
      </motion.div>

      {/* ── Compact Core Operations ── */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Quick Actions</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {visibleOps.map((op) => (
            <Link
              key={op.label}
              to={op.path}
              className="flex flex-col p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/80 dark:border-slate-800/60 hover:border-primary/40 shadow-xs hover:shadow-md transition-all active:scale-95 group"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110", op.color)}>
                <op.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">
                {op.label}
              </h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium line-clamp-1">
                {op.desc}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recently Completed Patients (Compact) ── */}
      {completedList.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Recently Consulted</h3>
            <span className="text-[11px] font-bold text-primary">{completedList.length} Finished</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {completedList.map((visit: any) => (
              <div
                key={visit.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-white/80 dark:border-slate-800/60 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                    #{visit.token_number}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {(visit.patients?.title ? visit.patients.title + ' ' : '') + visit.patients?.name}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-medium">Consultation Finished</p>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}