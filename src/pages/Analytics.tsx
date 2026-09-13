import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { startOfDay, endOfDay, isWithinInterval, startOfHour, endOfHour, setHours, format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, Label, LineChart, Line, Legend, ComposedChart
} from 'recharts';
import {
  Users, CalendarDays, Activity, Pill, Filter, Lightbulb, Sparkles, TrendingUp, X,
  Clock, CheckCircle2, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight,
  Stethoscope, UserRound, LayoutDashboard, Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getPatientCurrentAge } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import PageBanner from '@/components/PageBanner';
import analyticsBanner from '@/assets/analytics.jpg';
import Lottie from "lottie-react";
import analyticsAnimation from "@/assets/animations/analytics.json";
import { ChartContainer, CustomTooltip, MetricCard } from '@/components/AnalyticsComponents';

type TimeRange = 'today' | 'week' | 'month' | 'year';

import type { Clinic } from '@/types/clinic';

export default function Analytics() {
  const { clinic } = useOutletContext<{ clinic: Clinic }>();
  const [stats, setStats] = useState({
    todayPatients: 0,
    monthPatients: 0,
    totalPatients: 0,
    completionRate: 0,
    avgConsultTime: '— min'
  });
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [trends, setTrends] = useState({ today: '', month: '', completion: '' });
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [seasonalityData, setSeasonalityData] = useState<any[]>([]);
  const [demographics, setDemographics] = useState<{ sex: any[], age: any[] }>({ sex: [], age: [] });
  const [protocolData, setProtocolData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [smartInsight, setSmartInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [allDiagnosesSnapshot, setAllDiagnosesSnapshot] = useState<{ name: string, value: number }[]>([]);

  // Dynamic page title
  useEffect(() => {
    document.title = `Analytics${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  useEffect(() => {
    if (clinic?.id) {
      fetchAllData();
    }
  }, [clinic?.id, timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchGeneralStats(),
      fetchVolumeData(),
      fetchSeasonalityData(),
      fetchDemographics(),
      fetchProtocolAnalytics()
    ]);
    setLoading(false);
  };

  const fetchGeneralStats = async () => {
    const now = new Date();
    const todayStart = startOfDay(now).toISOString();
    const todayEnd = endOfDay(now).toISOString();
    
    const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
    const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();

    const monthStartStr = startOfMonth(now).toISOString();
    
    const lastMonthStartStr = startOfMonth(subMonths(now, 1)).toISOString();
    const lastMonthEndStr = endOfMonth(subMonths(now, 1)).toISOString();

    const [todayRes, yesterdayRes, monthRes, lastMonthRes, totalRes, statusRes] = await Promise.all([
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic?.id).gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic?.id).gte('created_at', yesterdayStart).lte('created_at', yesterdayEnd),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic?.id).gte('created_at', monthStartStr),
      supabase.from('visits').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic?.id).gte('created_at', lastMonthStartStr).lte('created_at', lastMonthEndStr),
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('clinic_id', clinic?.id),
      supabase.from('visits').select('status').eq('clinic_id', clinic?.id).gte('created_at', monthStartStr)
    ]);

    const todayCount = todayRes.count || 0;
    const yesterdayCount = yesterdayRes.count || 0;
    const monthCount = monthRes.count || 0;
    const lastMonthCount = lastMonthRes.count || 0;

    // Calculate Completion Rate
    const totalVisits = statusRes.data?.length || 0;
    const completedVisits = statusRes.data?.filter(v => v.status === 'completed').length || 0;
    const completionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;

    // Calculate avg consult time from completed visits (updated_at - created_at)
    const { data: completedVisitsData } = await supabase
      .from('visits')
      .select('created_at, updated_at')
      .eq('clinic_id', clinic?.id)
      .eq('status', 'completed')
      .gte('created_at', monthStartStr)
      .limit(100);

    let avgConsultTime = '— min';
    if (completedVisitsData && completedVisitsData.length > 0) {
      const validDurations = completedVisitsData
        .map(v => {
          const created = new Date(v.created_at).getTime();
          const updated = new Date(v.updated_at).getTime();
          const diffMin = (updated - created) / 60000;
          return diffMin > 1 && diffMin < 120 ? diffMin : null; // Ignore outliers
        })
        .filter((d): d is number => d !== null);
      if (validDurations.length > 0) {
        const avg = Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length);
        avgConsultTime = `${avg}m`;
      }
    }

    setStats(prev => ({
      ...prev,
      todayPatients: todayCount,
      monthPatients: monthCount,
      totalPatients: totalRes.count || 0,
      completionRate,
      avgConsultTime
    }));

    setTrends({
      today: yesterdayCount > 0 ? `${todayCount >= yesterdayCount ? '+' : ''}${Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)}%` : '+100%',
      month: lastMonthCount > 0 ? `${monthCount >= lastMonthCount ? '+' : ''}${Math.round(((monthCount - lastMonthCount) / lastMonthCount) * 100)}%` : '+100%',
      completion: completionRate > 80 ? 'Optimal' : 'Attention needed'
    });

    // Diagnosis distribution (top 6)
    const { data: rxData } = await supabase.from('prescriptions').select('diagnosis').eq('clinic_id', clinic?.id).not('diagnosis', 'is', null).not('diagnosis', 'eq', '').limit(1000);
    const counts: Record<string, number> = {};
    rxData?.forEach(r => {
      if (r.diagnosis) {
        // Diagnosis is now stored as comma-separated string, sometimes with slashes, we'll split by both
        const terms = r.diagnosis.split(/[,/\\|]+/).map(t => t.trim().toUpperCase()).filter(t => t.length > 1);
        terms.forEach(term => {
          counts[term] = (counts[term] || 0) + 1;
        });
      }
    });
    const allSorted = Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    setAllDiagnosesSnapshot(allSorted);
    setDiagnosisData(allSorted.slice(0, 6)); // Default top 6
  };

  const fetchDemographics = async () => {
    let allPatients: any[] = [];
    let hasMore = true;
    let offset = 0;
    
    while(hasMore) {
      const { data } = await supabase.from('patients').select('age, dob, created_at, sex').eq('clinic_id', clinic?.id).range(offset, offset + 999);
      if (data && data.length > 0) {
        allPatients.push(...data);
        if (data.length < 1000) hasMore = false;
        else offset += 1000;
      } else {
        hasMore = false;
      }
    }

    // Sex distribution
    const sexCounts: Record<string, number> = { Male: 0, Female: 0, Others: 0 };
    allPatients.forEach(p => {
      const s = p.sex === 'Male' ? 'Male' : p.sex === 'Female' ? 'Female' : 'Others';
      sexCounts[s]++;
    });

    // Age distribution
    const ageGroups: Record<string, number> = {
      '0-12 (Pediatric)': 0,
      '12-18 (Adolescence)': 0,
      '18-45 (Adult)': 0,
      '45-60 (Senior)': 0,
      '60+ (Geriatric)': 0
    };
    allPatients.forEach(p => {
      const age = getPatientCurrentAge(p) ?? p.age ?? 0;
      if (age <= 12) ageGroups['0-12 (Pediatric)']++;
      else if (age <= 18) ageGroups['12-18 (Adolescence)']++;
      else if (age <= 45) ageGroups['18-45 (Adult)']++;
      else if (age <= 60) ageGroups['45-60 (Senior)']++;
      else ageGroups['60+ (Geriatric)']++;
    });

    setDemographics({
      sex: Object.entries(sexCounts).map(([name, value]) => ({ name, value })),
      age: Object.entries(ageGroups).map(([name, value]) => ({ name, value }))
    });
  };

  const fetchProtocolAnalytics = async () => {
    const { data: rxData } = await supabase.from('prescriptions').select('medicines, diagnosis').eq('clinic_id', clinic?.id).limit(1000);
    if (!rxData) return;

    // Medicine frequency
    const medCounts: Record<string, number> = {};
    rxData.forEach(rx => {
      const medicines = Array.isArray(rx.medicines) ? rx.medicines : [];
      medicines.forEach((m: any) => {
        if (m.name) {
          const name = m.name.toUpperCase();
          medCounts[name] = (medCounts[name] || 0) + 1;
        }
      });
    });

    setProtocolData(Object.entries(medCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8));
  };



  const fetchVolumeData = async () => {
    let daysCount = 7;
    let formatType: 'day' | 'month' = 'day';

    if (timeRange === 'today') daysCount = 1;
    else if (timeRange === 'week') daysCount = 7;
    else if (timeRange === 'month') daysCount = 30;
    else if (timeRange === 'year') {
      daysCount = 12;
      formatType = 'month';
    }

    const now = new Date();
    let startDate: Date;

    if (formatType === 'day') {
      startDate = startOfDay(subDays(now, daysCount - 1));
    } else {
      startDate = startOfDay(startOfMonth(subMonths(now, 11)));
    }

    let allVisits: any[] = [];
    let hasMore = true;
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (hasMore) {
      const { data } = await supabase
        .from('visits')
        .select('created_at')
        .eq('clinic_id', clinic?.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (data && data.length > 0) {
        allVisits.push(...data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += PAGE_SIZE;
        }
      } else {
        hasMore = false;
      }
    }

    // Compute Peak Hours for the selected time range
    const hourBins: Record<number, number> = {};
    for (let i = 8; i <= 22; i++) hourBins[i] = 0;

    let validVisitsCount = 0;
    allVisits.forEach(v => {
      const hour = new Date(v.created_at).getHours();
      if (hour >= 8 && hour <= 22) {
        hourBins[hour]++;
        validVisitsCount++;
      }
    });

    setPeakHoursData(Object.entries(hourBins).map(([hour, count]) => ({
      hour: format(setHours(startOfDay(now), parseInt(hour)), 'ha'),
      percentage: validVisitsCount > 0 ? Math.round((count / validVisitsCount) * 100) : 0,
      _hour: parseInt(hour)
    })));

    const resultData: any[] = [];
    const bins: Record<string, any> = {};

    if (timeRange === 'today') {
      for (let h = 0; h < 24; h++) {
        const d = setHours(startOfDay(now), h);
        const name = format(d, 'ha');
        bins[name] = { count: 0, _order: h };
      }
      allVisits.forEach(v => {
        const d = new Date(v.created_at);
        const name = format(d, 'ha');
        if (bins[name]) bins[name].count++;
      });
      Object.keys(bins).forEach(key => resultData.push({ name: key, patients: bins[key].count }));
    } else if (formatType === 'day') {
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = subDays(now, i);
        const name = format(d, i < 7 ? 'EEE, MMM d' : 'MMM d');
        const key = format(d, 'yyyy-MM-dd');
        bins[key] = { name, count: 0 };
      }
      allVisits.forEach(v => {
        const key = format(new Date(v.created_at), 'yyyy-MM-dd');
        if (bins[key]) bins[key].count++;
      });
      Object.keys(bins).forEach(key => resultData.push({ name: bins[key].name, patients: bins[key].count }));
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(now, i);
        const name = format(d, 'MMM yyyy');
        const key = format(d, 'yyyy-MM');
        bins[key] = { name, count: 0 };
      }
      allVisits.forEach(v => {
        const key = format(new Date(v.created_at), 'yyyy-MM');
        if (bins[key]) bins[key].count++;
      });
      Object.keys(bins).forEach(key => resultData.push({ name: bins[key].name, patients: bins[key].count }));
    }
    setVolumeData(resultData);
  };

  const fetchSeasonalityData = async () => {
    const sixMonthsAgo = subMonths(new Date(), 6);
    const { data: rxData } = await supabase
      .from('prescriptions')
      .select('diagnosis, created_at')
      .eq('clinic_id', clinic?.id)
      .not('diagnosis', 'is', null)
      .gte('created_at', sixMonthsAgo.toISOString())
      .order('created_at', { ascending: true });

    if (!rxData) return;

    // Automatically detect top 5 diagnoses instead of hardcoding
    const topDetectCounts: Record<string, number> = {};
    rxData.forEach(rx => {
      const terms = rx.diagnosis?.split(/[,/\\|]+/).map(t => t.trim()).filter(t => t.length > 2) || [];
      terms.forEach(t => topDetectCounts[t] = (topDetectCounts[t] || 0) + 1);
    });
    const topDiagnoses = Object.entries(topDetectCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

    const months = Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), 5 - i), 'MMM'));
    const trendData = months.map(m => {
      const entry: any = { month: m };
      topDiagnoses.forEach(d => entry[d] = 0);
      return entry;
    });

    rxData.forEach(rx => {
      const monthStr = format(new Date(rx.created_at), 'MMM');
      const entry = trendData.find(t => t.month === monthStr);
      if (entry) {
        topDiagnoses.forEach(d => {
          if (rx.diagnosis?.toLowerCase().includes(d.toLowerCase())) entry[d]++;
        });
      }
    });

    setSeasonalityData(trendData);
  };

  const filteredDiagnosisData = useMemo(() => {
    if (selectedDiagnoses.length === 0) return diagnosisData;
    return allDiagnosesSnapshot.filter(d => selectedDiagnoses.includes(d.name));
  }, [selectedDiagnoses, diagnosisData, allDiagnosesSnapshot]);

  const toggleDiagnosis = (name: string) => {
    setSelectedDiagnoses(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const generateInsight = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const topDiag = diagnosisData[0]?.name || "general conditions";
      const peakHour = [...peakHoursData].sort((a, b) => b.patients - a.patients)[0];
      const periodText = timeRange === 'today' ? 'Daily' : timeRange === 'month' ? 'Monthly' : timeRange === 'year' ? 'Yearly' : 'Weekly';

      let insight = `Trend Alert: ${topDiag} represents your highest patient volume. ${periodText} peak typically occurs around ${peakHour?.hour || 'peak hours'}.`;
      if (stats.completionRate < 70) insight += " Note: Appointment completion rate is below optimal (70%). Consider reviewing waiting times.";

      setSmartInsight(insight);
      setIsAnalyzing(false);
    }, 1500);
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

  if (!clinic?.id) return null;

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700 pb-20 font-jakarta-sans bg-slate-50/50 dark:bg-slate-950/50">
      <PageBanner
        title="Predictive Analytics"
        description="Leveraging clinical data to optimize patient care and operational efficiency. (v1.1)"
        imageSrc={analyticsBanner}
      >
        <div className="w-24 h-24 md:w-40 md:h-40 -ml-6 -mt-4 opacity-90 drop-shadow-2xl">
          <Lottie animationData={analyticsAnimation} loop={true} />
        </div>
      </PageBanner>

      <div className="px-4 md:px-10 lg:px-16 relative z-20 space-y-8">
        {/* Header & Smart Insights */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          <AnimatePresence mode="wait">
            {smartInsight ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className="flex-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-primary/20 p-5 rounded-[2.5rem] flex items-center gap-5 shadow-2xl relative group"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                  <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                </div>
                <div className="flex-1 pr-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/60 mb-1">AI Intelligence Insight</p>
                  <p className="text-sm font-extrabold text-foreground leading-[1.6]">{smartInsight}</p>
                </div>
                <button
                  onClick={() => setSmartInsight(null)}
                  className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-90"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </motion.div>
            ) : (
              <div className="flex-1 flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-4 rounded-[2.5rem] border border-border shadow-sm">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <LayoutDashboard className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-muted-foreground">Welcome to your clinical dashboard. Run intelligence check for deep insights.</p>
              </div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-2 rounded-[2rem] border border-border shadow-soft h-fit">
            <Button
              className={cn(
                "rounded-[1.5rem] text-[11px] h-12 px-6 font-black uppercase tracking-widest gap-2 bg-primary text-white hover:bg-primary/90 transition-all shadow-lg active:scale-95",
                isAnalyzing && "opacity-50 cursor-not-allowed"
              )}
              onClick={generateInsight}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <TrendingUp className="w-4 h-4" />
                </motion.div>
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isAnalyzing ? "Deep Analysis..." : "Run Intelligence Check"}
            </Button>
            <div className="h-8 w-[1px] bg-border/50 mx-1 hidden md:block" />
            <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
              <SelectTrigger className="w-[140px] h-12 bg-transparent border-none font-black text-[11px] uppercase tracking-widest rounded-[1.5rem] hover:bg-slate-100 dark:hover:bg-slate-800 transition-all px-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <SelectValue placeholder="Period" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/50 shadow-2xl">
                <SelectItem value="today" className="font-bold text-xs">Today</SelectItem>
                <SelectItem value="week" className="font-bold text-xs">Past Week</SelectItem>
                <SelectItem value="month" className="font-bold text-xs">Past Month</SelectItem>
                <SelectItem value="year" className="font-bold text-xs">Past Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Global Progress Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            label="Today's Load"
            value={stats.todayPatients}
            icon={<Users className="w-6 h-6" />}
            color="bg-blue-500/10 text-blue-500"
            trend={trends.today}
            delay={0.1}
          />
          <MetricCard
            label="Monthly Volume"
            value={stats.monthPatients}
            icon={<Activity className="w-6 h-6" />}
            color="bg-emerald-500/10 text-emerald-500"
            trend={trends.month}
            delay={0.2}
          />
          <MetricCard
            label="Database Size"
            value={stats.totalPatients}
            icon={<Database className="w-6 h-6" />}
            color="bg-purple-500/10 text-purple-500"
            trend="Lifetime"
            delay={0.3}
          />
          <MetricCard
            label="Case Closure"
            value={`${stats.completionRate}%`}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="bg-amber-500/10 text-amber-500"
            trend={trends.completion}
            delay={0.4}
          />
        </div>

        {/* Main Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

          {/* Patient Traffic - Large Area/Bar Mixed */}
          <div className="xl:col-span-2">
            <ChartContainer
              title="Patient Flow Dynamics"
              description={`Patient Volume · ${timeRange.toUpperCase()}`}
              icon={<TrendingUp className="w-5 h-5" />}
              className="h-full"
            >
              <ComposedChart data={volumeData} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <defs>
                  <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 800 }} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--primary))', opacity: 0.1 }} />
                <Area type="monotone" dataKey="patients" fill="url(#flowGradient)" stroke="none" />
                <Bar dataKey="patients" barSize={32} radius={[10, 10, 0, 0]}>
                  {volumeData.map((entry, i) => {
                    const prev = volumeData[i - 1];
                    let color = 'hsl(var(--primary))';
                    if (prev) {
                      if (entry.patients > prev.patients) color = '#10b981';
                      else if (entry.patients < prev.patients) color = '#ef4444';
                    }
                    return <Cell key={i} fill={color} fillOpacity={0.8} />;
                  })}
                </Bar>
                <Line type="monotone" dataKey="patients" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} />
                {volumeData.length > 0 && (
                  <ReferenceLine 
                    y={volumeData.reduce((acc, curr) => acc + curr.patients, 0) / volumeData.length} 
                    stroke="currentColor" 
                    strokeDasharray="3 3" 
                    strokeOpacity={0.5} 
                  >
                    <Label 
                      value={`Avg: ${Math.round(volumeData.reduce((acc, curr) => acc + curr.patients, 0) / volumeData.length)}`} 
                      position="top" 
                      fill="currentColor" 
                      fontSize={12} 
                      fontWeight="bold" 
                      opacity={0.7}
                    />
                  </ReferenceLine>
                )}
              </ComposedChart>
            </ChartContainer>
          </div>

          <ChartContainer
            title="Diagnosis Mix"
            description={selectedDiagnoses.length > 0 ? "Selected Clinical Reasons" : "Top 6 Clinical Reasons"}
            icon={<Stethoscope className="w-5 h-5" />}
            extra={
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 rounded-2xl shadow-2xl" align="end">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <h4 className="text-xs font-black uppercase tracking-widest">Select Diagnosis</h4>
                    {selectedDiagnoses.length > 0 && (
                      <button onClick={() => setSelectedDiagnoses([])} className="text-[10px] font-black text-primary hover:underline uppercase">Clear</button>
                    )}
                  </div>
                  <ScrollArea className="h-[250px] pr-3">
                    <div className="space-y-2.5">
                      {allDiagnosesSnapshot.map((d) => (
                        <div key={d.name} className="flex items-center space-x-2 group">
                          <Checkbox
                            id={`diag-${d.name}`}
                            checked={selectedDiagnoses.includes(d.name)}
                            onCheckedChange={() => toggleDiagnosis(d.name)}
                          />
                          <label htmlFor={`diag-${d.name}`} className="text-xs font-bold leading-none cursor-pointer group-hover:text-primary transition-colors flex-1 flex justify-between">
                            <span className="truncate pr-2">{d.name}</span>
                            <span className="text-muted-foreground tabular-nums">{d.value}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            }
          >
            <PieChart>
              <Pie
                data={filteredDiagnosisData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={90}
                paddingAngle={8}
                dataKey="value"
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {filteredDiagnosisData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} cornerRadius={5} />)}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6">
              {filteredDiagnosisData.map((d, i) => (
                <div key={d.name} className="flex flex-col gap-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-black uppercase text-muted-foreground truncate tracking-tighter" title={d.name}>{d.name}</span>
                  </div>
                  <span className="text-lg font-black pl-4 leading-none">{d.value}</span>
                </div>
              ))}
            </div>
          </ChartContainer>

          {/* Demographics Row */}
          <ChartContainer
            title="Patient Demographics"
            description="Age-based categorization"
            icon={<Users className="w-5 h-5" />}
          >
            <BarChart data={demographics.age} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 10, fontWeight: 800 }}
                width={120}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} barSize={20} />
            </BarChart>
          </ChartContainer>

          {/* Operational: Peak Hours */}
          <ChartContainer
            title="Appointment Loads"
            description="Time-based percentage distribution"
            icon={<Clock className="w-5 h-5" />}
          >
            <AreaChart data={peakHoursData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700 }} tickFormatter={(val) => `${val}%`} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area type="stepAfter" dataKey="percentage" stroke="#f59e0b" fill="url(#peakGradient)" strokeWidth={3} />
            </AreaChart>
          </ChartContainer>

          {/* Operational: Sex Ratio */}
          <ChartContainer
            title="Patient Diversity"
            description="Sex Ratio Breakdown"
            icon={<UserRound className="w-5 h-5" />}
          >
            <PieChart>
              <Pie
                data={demographics.sex}
                cx="50%"
                cy="50%"
                stroke="none"
                innerRadius={50}
                outerRadius={85}
                dataKey="value"
              >
                {demographics.sex.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : i === 1 ? '#ec4899' : '#10b981'} />)}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend iconType="circle" />
            </PieChart>
          </ChartContainer>

          {/* Medicine/Protocol Analytics - Full Width */}
          <div className="xl:col-span-3">
            <ChartContainer
              title="Pharmacotherapy Insights"
              description="Most Frequently Prescribed Medications / Protocols"
              icon={<Pill className="w-5 h-5" />}
            >
              <BarChart data={protocolData} margin={{ top: 20, right: 30, bottom: 40, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontWeight: 900, fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} barSize={40}>
                  {protocolData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Disease Seasonality Chart */}
          <div className="xl:col-span-3">
            <ChartContainer
              title="Clinical Seasonality"
              description="6-Month Trend Analysis of Core Diagnoses"
              icon={<Activity className="w-5 h-5" />}
            >
              <AreaChart data={seasonalityData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                <defs>
                  {seasonalityData[0] && Object.keys(seasonalityData[0]).filter(k => k !== 'month').map((key, i) => (
                    <linearGradient key={key} id={`fade${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 800 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                {seasonalityData[0] && Object.keys(seasonalityData[0]).filter(k => k !== 'month').map((key, i) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    fill={`url(#fade${i})`}
                    strokeWidth={4}
                    animationDuration={2000}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
          </div>

        </div>
      </div>
    </div>
  );
}