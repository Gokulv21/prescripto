import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { 
  startOfDay, endOfDay, isWithinInterval, startOfHour, endOfHour, 
  setHours, format, subDays, subMonths, startOfMonth, endOfMonth,
  differenceInDays, startOfWeek, endOfWeek, isSameDay
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, ReferenceLine, ReferenceArea, Label, LineChart, Line, Legend, ComposedChart
} from 'recharts';
import {
  Users, CalendarDays, Activity, Pill, Filter, Lightbulb, Sparkles, TrendingUp, X,
  Clock, CheckCircle2, AlertCircle, Calendar, ArrowUpRight, ArrowDownRight,
  Stethoscope, UserRound, LayoutDashboard, Database, ChevronLeft, ChevronRight,
  CalendarRange, Check, Layers, BarChart2, ZoomIn, ZoomOut, RotateCcw, UserCheck, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, getPatientCurrentAge } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import PageBanner from '@/components/PageBanner';
import analyticsBanner from '@/assets/analytics.jpg';
import Lottie from "lottie-react";
import analyticsAnimation from "@/assets/animations/analytics.json";
import { ChartContainer, CustomTooltip, MetricCard } from '@/components/AnalyticsComponents';

type FlowTimeRange = 'today' | '7d' | '30d' | '90d' | '1y' | 'custom';
type FlowScale = 'daily' | 'weekly' | 'monthly';

const HOUR_TICKS_24 = [
  '00:00', '02:00', '04:00', '06:00', '08:00', '10:00',
  '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'
];

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`
}));

interface SmartInsightItem {
  id: string;
  category: 'Clinical Focus' | 'Queue Dynamics' | 'Peak Capacity' | 'Prescription Audit' | 'Demographics';
  title: string;
  description: string;
  recommendation: string;
  badgeColor: string;
}

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
  
  // Patient Flow Dynamics State
  const [flowTimeRange, setFlowTimeRange] = useState<FlowTimeRange>('7d');
  const [flowScale, setFlowScale] = useState<FlowScale>('daily');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 1 = 100%, 2 = 60%, 3 = 35%
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [flowMetrics, setFlowMetrics] = useState({
    todayLiveCount: 0,
    completedPeriodAvg: 0,
    completedDaysCount: 7,
    periodTotal: 0,
    periodPeak: { count: 0, label: '—' },
    periodLow: { count: 0, label: '—' },
    rangeDescription: 'Past 7 Completed Days'
  });

  const [volumeData, setVolumeData] = useState<any[]>([]);

  const handleZoomIn = () => {
    if (zoomLevel < 3) {
      setZoomLevel(prev => prev + 1);
      if (flowScale === 'monthly') setFlowScale('weekly');
      else if (flowScale === 'weekly') setFlowScale('daily');
    } else {
      if (flowScale === 'monthly') {
        setFlowScale('weekly');
        setZoomLevel(1);
      } else if (flowScale === 'weekly') {
        setFlowScale('daily');
        setZoomLevel(1);
      }
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 1) {
      setZoomLevel(prev => prev - 1);
    } else {
      if (flowScale === 'daily') setFlowScale('weekly');
      else if (flowScale === 'weekly') setFlowScale('monthly');
    }
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    if (flowTimeRange === '7d' || flowTimeRange === '30d') setFlowScale('daily');
    else if (flowTimeRange === '90d') setFlowScale('weekly');
    else if (flowTimeRange === '1y') setFlowScale('monthly');
  };

  const displayedVolumeData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return [];
    if (zoomLevel === 1) return volumeData;
    const factor = zoomLevel === 2 ? 0.6 : 0.35;
    const count = Math.max(5, Math.round(volumeData.length * factor));
    return volumeData.slice(volumeData.length - count);
  }, [volumeData, zoomLevel]);
  const [trends, setTrends] = useState({ today: '', month: '', completion: '' });
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [seasonalityRxList, setSeasonalityRxList] = useState<any[]>([]);
  const [allSeasonalityDiagnoses, setAllSeasonalityDiagnoses] = useState<{ name: string; count: number }[]>([]);
  const [selectedSeasonalityDiagnoses, setSelectedSeasonalityDiagnoses] = useState<string[]>([]);
  const [demographics, setDemographics] = useState<{ sex: any[], age: any[] }>({ sex: [], age: [] });
  const [protocolData, setProtocolData] = useState<any[]>([]);
  const [retentionData, setRetentionData] = useState<any[]>([]);
  const [peakHoursData, setPeakHoursData] = useState<any[]>([]);
  const [appointmentLoadRange, setAppointmentLoadRange] = useState<'all' | 'today' | '7d' | '30d'>('today');
  const [appointmentLoadsTotal, setAppointmentLoadsTotal] = useState<number>(0);
  const [customStartHour, setCustomStartHour] = useState<number>(10);
  const [customEndHour, setCustomEndHour] = useState<number>(14);
  const [loadPeriodStats, setLoadPeriodStats] = useState({
    morning: { count: 0, avgPerHour: '0.0', avgPerDay: '0.0', percent: 0 },
    afternoon: { count: 0, avgPerHour: '0.0', avgPerDay: '0.0', percent: 0 },
    evening: { count: 0, avgPerHour: '0.0', avgPerDay: '0.0', percent: 0 },
    night: { count: 0, avgPerHour: '0.0', avgPerDay: '0.0', percent: 0 },
    activeHoursAvg: '0.0',
    dailyAvg: '0.0',
    peakPeriodName: 'Afternoon (12:00 - 17:00)',
    peakPeriodCount: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Smart Insights state
  const [smartInsightsList, setSmartInsightsList] = useState<SmartInsightItem[]>([]);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);
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
  }, [clinic?.id]);

  useEffect(() => {
    if (clinic?.id) {
      fetchVolumeData();
    }
  }, [clinic?.id, flowTimeRange, flowScale, customStartDate, customEndDate]);

  useEffect(() => {
    if (clinic?.id) {
      fetchAppointmentLoads(appointmentLoadRange);
    }
  }, [clinic?.id, appointmentLoadRange]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchGeneralStats(),
      fetchVolumeData(),
      fetchAppointmentLoads(appointmentLoadRange),
      fetchSeasonalityData(),
      fetchDemographics(),
      fetchProtocolAnalytics(),
      fetchRetentionData()
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

  const fetchRetentionData = async () => {
    let allVisits: { patient_id: string; created_at: string }[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('visits')
        .select('patient_id, created_at')
        .eq('clinic_id', clinic?.id)
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('[Analytics] Error fetching retention visits:', error);
        break;
      }
      if (data && data.length > 0) {
        allVisits.push(...data);
        if (data.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    if (allVisits.length === 0) return;

    // Track first visit date for each patient to determine New vs Returning
    const patientFirstVisit = new Map<string, string>();
    allVisits.forEach(v => {
      if (!patientFirstVisit.has(v.patient_id)) {
        patientFirstVisit.set(v.patient_id, v.created_at);
      }
    });

    const monthlyStats = new Map<string, { month: string; monthLabel: string; newPatients: number; returningPatients: number; total: number; retentionRate: number }>();
    allVisits.forEach(v => {
      const d = new Date(v.created_at);
      const key = format(d, 'yyyy-MM');
      const monthLabel = format(d, 'MMM yyyy');
      if (!monthlyStats.has(key)) {
        monthlyStats.set(key, { month: key, monthLabel, newPatients: 0, returningPatients: 0, total: 0, retentionRate: 0 });
      }
      const stat = monthlyStats.get(key)!;
      const isFirst = patientFirstVisit.get(v.patient_id) === v.created_at;
      if (isFirst) {
        stat.newPatients++;
      } else {
        stat.returningPatients++;
      }
      stat.total++;
    });

    // Calculate retention percentage for each month and take the active months
    const sorted = Array.from(monthlyStats.values()).map(m => ({
      ...m,
      retentionRate: m.total > 0 ? Math.round((m.returningPatients / m.total) * 100) : 0
    }));

    setRetentionData(sorted.slice(-7));
  };

  const fetchAppointmentLoads = async (range: 'all' | 'today' | '7d' | '30d' = appointmentLoadRange) => {
    if (!clinic?.id) return;
    const now = new Date();
    let query = supabase.from('visits').select('created_at').eq('clinic_id', clinic.id);

    if (range === 'today') {
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      query = query.gte('created_at', todayStart).lte('created_at', todayEnd);
    } else if (range === '7d') {
      const sevenDaysAgo = startOfDay(subDays(now, 7)).toISOString();
      query = query.gte('created_at', sevenDaysAgo);
    } else if (range === '30d') {
      const thirtyDaysAgo = startOfDay(subDays(now, 30)).toISOString();
      query = query.gte('created_at', thirtyDaysAgo);
    }

    let allVisits: { created_at: string }[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('[Analytics] Fetch appointment loads error:', error);
        break;
      }
      if (data && data.length > 0) {
        allVisits.push(...data);
        if (data.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    setAppointmentLoadsTotal(allVisits.length);

    // Peak Hours calculation across all 24 hours: 00:00 to 24:00 of a day
    const hourBins: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourBins[i] = 0;
    allVisits.forEach(v => {
      const hour = new Date(v.created_at).getHours();
      if (hour >= 0 && hour < 24) {
        hourBins[hour]++;
      }
    });

    const hoursData = [];
    for (let h = 0; h < 24; h++) {
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      hoursData.push({
        hour: hourStr,
        patients: hourBins[h] || 0,
        _hour: h
      });
    }
    // 24:00 boundary tick closing out the full 24-hr day
    hoursData.push({
      hour: '24:00',
      patients: 0,
      _hour: 24
    });

    setPeakHoursData(hoursData);

    // Calculate period statistics & averages (Morning, Afternoon, Evening, Night)
    let morningCount = 0, afternoonCount = 0, eveningCount = 0, nightCount = 0;
    for (let h = 0; h < 24; h++) {
      const c = hourBins[h] || 0;
      if (h >= 6 && h < 12) morningCount += c;
      else if (h >= 12 && h < 17) afternoonCount += c;
      else if (h >= 17 && h < 21) eveningCount += c;
      else nightCount += c;
    }

    const totalPts = allVisits.length;
    let daysCount = 1;
    if (range === '7d') daysCount = 7;
    else if (range === '30d') daysCount = 30;
    else if (range === 'all') {
      if (allVisits.length > 0) {
        const earliest = new Date(allVisits[allVisits.length - 1].created_at);
        daysCount = Math.max(1, Math.round((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    const activeHours = Object.values(hourBins).filter(c => c > 0).length || 1;
    const activeHoursAvg = totalPts > 0 ? (totalPts / (range === 'today' ? activeHours : (daysCount * 12))).toFixed(1) : '0.0';
    const dailyAvg = (totalPts / daysCount).toFixed(1);

    const periods = [
      { name: 'Morning (06:00 - 12:00)', count: morningCount },
      { name: 'Afternoon (12:00 - 17:00)', count: afternoonCount },
      { name: 'Evening (17:00 - 21:00)', count: eveningCount },
      { name: 'Night (21:00 - 06:00)', count: nightCount }
    ].sort((a, b) => b.count - a.count);

    setLoadPeriodStats({
      morning: {
        count: morningCount,
        avgPerHour: (morningCount / (daysCount * 6)).toFixed(1),
        avgPerDay: (morningCount / daysCount).toFixed(1),
        percent: totalPts > 0 ? Math.round((morningCount / totalPts) * 100) : 0
      },
      afternoon: {
        count: afternoonCount,
        avgPerHour: (afternoonCount / (daysCount * 5)).toFixed(1),
        avgPerDay: (afternoonCount / daysCount).toFixed(1),
        percent: totalPts > 0 ? Math.round((afternoonCount / totalPts) * 100) : 0
      },
      evening: {
        count: eveningCount,
        avgPerHour: (eveningCount / (daysCount * 4)).toFixed(1),
        avgPerDay: (eveningCount / daysCount).toFixed(1),
        percent: totalPts > 0 ? Math.round((eveningCount / totalPts) * 100) : 0
      },
      night: {
        count: nightCount,
        avgPerHour: (nightCount / (daysCount * 9)).toFixed(1),
        avgPerDay: (nightCount / daysCount).toFixed(1),
        percent: totalPts > 0 ? Math.round((nightCount / totalPts) * 100) : 0
      },
      activeHoursAvg,
      dailyAvg,
      peakPeriodName: periods[0]?.name || 'Afternoon (12:00 - 17:00)',
      peakPeriodCount: periods[0]?.count || 0
    });
  };



  const fetchVolumeData = async () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    let queryStartDate: Date;
    let queryEndDate: Date = endOfDay(now);
    let autoScale: FlowScale = 'daily';
    let rangeDesc = '';

    if (flowTimeRange === 'today') {
      queryStartDate = todayStart;
      autoScale = 'daily';
      rangeDesc = "Today's Hourly Flow";
    } else if (flowTimeRange === '7d') {
      queryStartDate = startOfDay(subDays(now, 7));
      autoScale = 'daily';
      rangeDesc = 'Past 7 Completed Days';
    } else if (flowTimeRange === '30d') {
      queryStartDate = startOfDay(subDays(now, 30));
      autoScale = 'daily';
      rangeDesc = 'Past 30 Days';
    } else if (flowTimeRange === '90d') {
      queryStartDate = startOfDay(subDays(now, 90));
      autoScale = 'weekly';
      rangeDesc = 'Past 90 Days';
    } else if (flowTimeRange === '1y') {
      queryStartDate = startOfDay(startOfMonth(subMonths(now, 11)));
      autoScale = 'monthly';
      rangeDesc = 'Past 12 Months';
    } else {
      const parsedStart = customStartDate ? new Date(customStartDate) : subDays(now, 30);
      const parsedEnd = customEndDate ? new Date(customEndDate) : now;
      queryStartDate = startOfDay(parsedStart);
      queryEndDate = endOfDay(parsedEnd);
      
      const diffDays = Math.max(1, Math.round((queryEndDate.getTime() - queryStartDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (diffDays <= 35) autoScale = 'daily';
      else if (diffDays <= 180) autoScale = 'weekly';
      else autoScale = 'monthly';
      rangeDesc = `${format(queryStartDate, 'MMM d, yyyy')} - ${format(queryEndDate, 'MMM d, yyyy')}`;
    }

    const effectiveScale = flowScale || autoScale;

    let allVisits: { created_at: string }[] = [];
    let hasMore = true;
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (hasMore) {
      const { data, error } = await supabase
        .from('visits')
        .select('created_at')
        .eq('clinic_id', clinic?.id)
        .gte('created_at', queryStartDate.toISOString())
        .lte('created_at', queryEndDate.toISOString())
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('[Analytics] Fetch volume error:', error);
        break;
      }
      if (data && data.length > 0) {
        allVisits.push(...data);
        if (data.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    // Separate today's visits from completed historical days
    const todayVisits = allVisits.filter(v => {
      const d = new Date(v.created_at);
      return d >= todayStart && d <= todayEnd;
    });
    const todayLiveCount = todayVisits.length;

    let resultData: any[] = [];
    let completedDaysTotal = 0;
    let completedDaysCount = 0;
    let peakCount = 0;
    let peakLabel = '—';
    let lowCount = Infinity;
    let lowLabel = '—';

    if (flowTimeRange === 'today') {
      const hourlyBins: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourlyBins[h] = 0;
      allVisits.forEach(v => {
        const h = new Date(v.created_at).getHours();
        if (hourlyBins[h] !== undefined) hourlyBins[h]++;
      });
      Object.entries(hourlyBins).forEach(([hourStr, count]) => {
        const h = parseInt(hourStr);
        const name = format(setHours(todayStart, h), 'ha');
        resultData.push({ name, patients: count, fullDate: `${name} today` });
        if (count > peakCount) { peakCount = count; peakLabel = `${count} (${name})`; }
        if (count < lowCount && count > 0) { lowCount = count; lowLabel = `${count} (${name})`; }
      });
      completedDaysTotal = todayLiveCount;
      completedDaysCount = 1;
    } else if (effectiveScale === 'daily') {
      const isWeekPreset = flowTimeRange === '7d';
      const dayMap = new Map<string, { name: string; fullDate: string; patients: number; isToday: boolean }>();

      if (isWeekPreset) {
        // Exactly the 7 COMPLETED days: subDays(now, 7) to subDays(now, 1)
        for (let i = 7; i >= 1; i--) {
          const d = subDays(now, i);
          const key = format(d, 'yyyy-MM-dd');
          const name = format(d, 'EEE, MMM d');
          const fullDate = format(d, 'EEEE, MMMM d, yyyy');
          dayMap.set(key, { name, fullDate, patients: 0, isToday: false });
        }
      } else {
        let curr = new Date(queryStartDate);
        while (curr <= queryEndDate) {
          const key = format(curr, 'yyyy-MM-dd');
          const isToday = key === format(now, 'yyyy-MM-dd');
          const name = format(curr, 'MMM d');
          const fullDate = format(curr, 'EEEE, MMMM d, yyyy');
          dayMap.set(key, { name, fullDate, patients: 0, isToday });
          curr = new Date(curr.getTime() + 86400000);
        }
      }

      allVisits.forEach(v => {
        const key = format(new Date(v.created_at), 'yyyy-MM-dd');
        if (dayMap.has(key)) {
          dayMap.get(key)!.patients++;
        }
      });

      dayMap.forEach((entry) => {
        resultData.push(entry);
        if (!entry.isToday) {
          completedDaysTotal += entry.patients;
          completedDaysCount++;
          if (entry.patients > peakCount) {
            peakCount = entry.patients;
            peakLabel = `${entry.patients} (${entry.name})`;
          }
          if (entry.patients < lowCount) {
            lowCount = entry.patients;
            lowLabel = `${entry.patients} (${entry.name})`;
          }
        }
      });
    } else if (effectiveScale === 'weekly') {
      const weekMap = new Map<string, { name: string; fullDate: string; patients: number }>();
      let curr = startOfWeek(queryStartDate, { weekStartsOn: 1 });
      const lastWeek = endOfWeek(queryEndDate, { weekStartsOn: 1 });

      while (curr <= lastWeek) {
        const wEnd = endOfWeek(curr, { weekStartsOn: 1 });
        const key = format(curr, 'yyyy-MM-dd');
        const name = `${format(curr, 'MMM d')} - ${format(wEnd, 'MMM d')}`;
        const fullDate = `Week of ${format(curr, 'MMMM d')} to ${format(wEnd, 'MMMM d, yyyy')}`;
        weekMap.set(key, { name, fullDate, patients: 0 });
        curr = new Date(curr.getTime() + 7 * 86400000);
      }

      allVisits.forEach(v => {
        const d = new Date(v.created_at);
        const wStart = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        if (weekMap.has(wStart)) {
          weekMap.get(wStart)!.patients++;
        }
      });

      weekMap.forEach(entry => {
        resultData.push(entry);
        completedDaysTotal += entry.patients;
        completedDaysCount += 7;
        if (entry.patients > peakCount) {
          peakCount = entry.patients;
          peakLabel = `${entry.patients} (${entry.name})`;
        }
        if (entry.patients < lowCount) {
          lowCount = entry.patients;
          lowLabel = `${entry.patients} (${entry.name})`;
        }
      });
    } else {
      // Monthly
      const monthMap = new Map<string, { name: string; fullDate: string; patients: number; daysCount: number }>();
      let curr = startOfMonth(queryStartDate);
      const endMonth = endOfMonth(queryEndDate);

      while (curr <= endMonth) {
        const key = format(curr, 'yyyy-MM');
        const name = format(curr, 'MMM yyyy');
        const fullDate = format(curr, 'MMMM yyyy');
        const daysInCurrentMonth = new Date(curr.getFullYear(), curr.getMonth() + 1, 0).getDate();
        monthMap.set(key, { name, fullDate, patients: 0, daysCount: daysInCurrentMonth });
        curr = startOfMonth(new Date(curr.getFullYear(), curr.getMonth() + 1, 1));
      }

      allVisits.forEach(v => {
        const key = format(new Date(v.created_at), 'yyyy-MM');
        if (monthMap.has(key)) {
          monthMap.get(key)!.patients++;
        }
      });

      monthMap.forEach(entry => {
        resultData.push(entry);
        completedDaysTotal += entry.patients;
        completedDaysCount += entry.daysCount;
        if (entry.patients > peakCount) {
          peakCount = entry.patients;
          peakLabel = `${entry.patients} (${entry.name})`;
        }
        if (entry.patients < lowCount) {
          lowCount = entry.patients;
          lowLabel = `${entry.patients} (${entry.name})`;
        }
      });
    }

    const completedPeriodAvg = completedDaysCount > 0 ? Math.round(completedDaysTotal / completedDaysCount) : 0;

    setVolumeData(resultData);
    setFlowMetrics({
      todayLiveCount,
      completedPeriodAvg,
      completedDaysCount,
      periodTotal: completedDaysTotal,
      periodPeak: { count: peakCount, label: peakLabel === '—' ? '—' : peakLabel },
      periodLow: { count: lowCount === Infinity ? 0 : lowCount, label: lowLabel === '—' ? '—' : lowLabel },
      rangeDescription: rangeDesc
    });
  };

  const fetchSeasonalityData = async () => {
    if (!clinic?.id) return;
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    let rxData: { diagnosis: string | null; created_at: string }[] = [];
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('diagnosis, created_at')
        .eq('clinic_id', clinic.id)
        .not('diagnosis', 'is', null)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('[Analytics] Error fetching seasonality:', error);
        break;
      }
      if (data && data.length > 0) {
        rxData.push(...data);
        if (data.length < PAGE_SIZE) hasMore = false;
        else offset += PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    setSeasonalityRxList(rxData);

    // Automatically detect all diagnoses with counts across the 6 months
    const topDetectCounts: Record<string, number> = {};
    rxData.forEach(rx => {
      const terms = rx.diagnosis?.split(/[,/\\|]+/).map(t => t.trim().toUpperCase()).filter(t => t.length > 2) || [];
      terms.forEach(t => topDetectCounts[t] = (topDetectCounts[t] || 0) + 1);
    });
    const sortedDiagnoses = Object.entries(topDetectCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    setAllSeasonalityDiagnoses(sortedDiagnoses);
  };

  const seasonalityData = useMemo(() => {
    if (seasonalityRxList.length === 0) return [];

    const activeDiagnoses = selectedSeasonalityDiagnoses.length > 0
      ? selectedSeasonalityDiagnoses
      : allSeasonalityDiagnoses.slice(0, 5).map(d => d.name);

    if (activeDiagnoses.length === 0) return [];

    const months = Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), 5 - i), 'MMM'));
    const trendData = months.map(m => {
      const entry: any = { month: m };
      activeDiagnoses.forEach(d => { entry[d] = 0; });
      return entry;
    });

    seasonalityRxList.forEach(rx => {
      const monthStr = format(new Date(rx.created_at), 'MMM');
      const entry = trendData.find(t => t.month === monthStr);
      if (entry) {
        activeDiagnoses.forEach(d => {
          if (rx.diagnosis?.toUpperCase().includes(d.toUpperCase())) entry[d]++;
        });
      }
    });

    return trendData;
  }, [seasonalityRxList, selectedSeasonalityDiagnoses, allSeasonalityDiagnoses]);

  const toggleSeasonalityDiagnosis = (name: string) => {
    setSelectedSeasonalityDiagnoses(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const customWindowStats = useMemo(() => {
    let count = 0;
    let duration = 0;

    const hourMap: Record<number, number> = {};
    peakHoursData.forEach(p => {
      if (p._hour !== undefined && p._hour < 24) {
        hourMap[p._hour] = p.patients || 0;
      }
    });

    if (customStartHour === customEndHour) {
      duration = 1;
      count = hourMap[customStartHour] || 0;
    } else if (customStartHour < customEndHour) {
      duration = customEndHour - customStartHour;
      for (let h = customStartHour; h < customEndHour; h++) {
        count += (hourMap[h] || 0);
      }
    } else {
      // Overnight window (e.g. 21:00 to 06:00)
      duration = (24 - customStartHour) + customEndHour;
      for (let h = 0; h < 24; h++) {
        if (h >= customStartHour || h < customEndHour) {
          count += (hourMap[h] || 0);
        }
      }
    }

    let daysCount = 1;
    if (appointmentLoadRange === '7d') daysCount = 7;
    else if (appointmentLoadRange === '30d') daysCount = 30;
    else if (appointmentLoadRange === 'all') {
      daysCount = Math.max(1, Math.round(appointmentLoadsTotal / 25));
    }

    const avgPerHour = duration > 0 ? (count / (duration * daysCount)).toFixed(1) : '0.0';
    const avgPerDay = (count / daysCount).toFixed(1);
    const percent = appointmentLoadsTotal > 0 ? Math.round((count / appointmentLoadsTotal) * 100) : 0;

    return {
      count,
      duration,
      avgPerHour,
      avgPerDay,
      percent,
      startLabel: `${customStartHour.toString().padStart(2, '0')}:00`,
      endLabel: `${customEndHour.toString().padStart(2, '0')}:00`
    };
  }, [peakHoursData, customStartHour, customEndHour, appointmentLoadRange, appointmentLoadsTotal]);

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
      const insights: SmartInsightItem[] = [];

      // 1. Clinical Focus / Top Diagnoses
      const topDiag = diagnosisData[0]?.name || "General Medical Consults";
      const topCount = diagnosisData[0]?.value || 0;
      const secondDiag = diagnosisData[1]?.name || null;
      insights.push({
        id: 'clinical-focus',
        category: 'Clinical Focus',
        title: `${topDiag} Accounts for Highest Clinical Demand`,
        description: `${topDiag} represents ${topCount} clinical encounters in this period${secondDiag ? `, closely followed by ${secondDiag}` : ''}. Clinical staffing should align with this caseload pattern.`,
        recommendation: `Ensure clinical protocols, diagnostic test kits, and frontline medications for ${topDiag} are kept fully stocked and accessible.`,
        badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'
      });

      // 2. Queue Dynamics & Consult Duration
      const compRate = stats.completionRate;
      insights.push({
        id: 'queue-dynamics',
        category: 'Queue Dynamics',
        title: compRate >= 80 ? 'High Patient Case Closure Rate' : 'Queue Bottleneck & Throughput Lag',
        description: `Current appointment completion rate stands at ${compRate}%. Average consultation handling duration is paced around ${stats.avgConsultTime}.`,
        recommendation: compRate >= 80 
          ? 'Queue progression is well-balanced. Maintain current nurse-doctor triage handover intervals.'
          : 'Appointment completion is below the 80% benchmark. Review waiting room triage handoffs and peak buffer scheduling.',
        badgeColor: compRate >= 80 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
      });

      // 3. Peak Capacity & Rush Hours
      const sortedPeak = [...peakHoursData].sort((a, b) => b.patients - a.patients);
      const topHour = sortedPeak[0];
      const peakPatientCount = topHour?.patients || 0;
      insights.push({
        id: 'peak-capacity',
        category: 'Peak Capacity',
        title: topHour ? `Peak Demand Inflow: ${topHour.hour}` : 'Evenly Distributed Traffic',
        description: topHour 
          ? `Highest patient inflow concentrates at ${topHour.hour} with ${peakPatientCount} logged arrivals. Surge pressure is highest during this window.`
          : 'Patient arrivals are evenly distributed across clinic operating hours without extreme spikes.',
        recommendation: topHour 
          ? `Stage front-desk staff 15 minutes prior to ${topHour.hour} to avoid registration queues and token bottlenecks.`
          : 'Maintain steady intake schedules and consider expanding evening follow-up slots.',
        badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50'
      });

      // 4. Prescription & Formulary Audit
      const topMed = protocolData[0]?.name || "Core Antibiotics & Analgesics";
      const topMedCount = protocolData[0]?.value || 0;
      insights.push({
        id: 'prescription-audit',
        category: 'Prescription Audit',
        title: `Primary Formulary Utilization: ${topMed}`,
        description: `${topMed} is your most frequently prescribed medication with ${topMedCount} dispenses.`,
        recommendation: `Audit pharmacy safety stock levels for ${topMed} to prevent stockouts during surge periods.`,
        badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
      });

      // 5. Demographics & Cohort Analysis
      const sortedAge = [...demographics.age].sort((a, b) => b.value - a.value);
      const topAgeGroup = sortedAge[0];
      insights.push({
        id: 'demographics',
        category: 'Demographics',
        title: topAgeGroup ? `Key Demographic: ${topAgeGroup.name}` : 'Balanced Demographic Distribution',
        description: topAgeGroup 
          ? `The largest demographic cohort visiting your clinic is ${topAgeGroup.name} (${topAgeGroup.value} registered patients).`
          : 'Patient age cohorts are balanced across pediatric, adult, and senior demographics.',
        recommendation: topAgeGroup 
          ? `Tailor preventive screening packages and digital health reminders specifically for the ${topAgeGroup.name} cohort.`
          : 'Maintain comprehensive clinical health programs across all life stages.',
        badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/50'
      });

      setSmartInsightsList(insights);
      setActiveInsightIndex(0);
      setIsAnalyzing(false);
    }, 1000);
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
            {smartInsightsList.length > 0 ? (
              <motion.div
                key={smartInsightsList[activeInsightIndex]?.id || activeInsightIndex}
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-primary/20 p-5 rounded-[2.5rem] shadow-xl relative group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10">
                      <Sparkles className="w-6 h-6 text-primary animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full border", smartInsightsList[activeInsightIndex]?.badgeColor)}>
                          {smartInsightsList[activeInsightIndex]?.category}
                        </span>
                        <span className="text-[11px] font-bold text-muted-foreground">
                          Insight {activeInsightIndex + 1} of {smartInsightsList.length}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-foreground tracking-tight">
                        {smartInsightsList[activeInsightIndex]?.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      disabled={activeInsightIndex === 0}
                      onClick={() => setActiveInsightIndex(prev => Math.max(0, prev - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs font-black text-muted-foreground w-8 text-center">
                      {activeInsightIndex + 1}/{smartInsightsList.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                      disabled={activeInsightIndex === smartInsightsList.length - 1}
                      onClick={() => setActiveInsightIndex(prev => Math.min(smartInsightsList.length - 1, prev + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full hover:bg-rose-50 hover:text-rose-500 ml-1"
                      onClick={() => setSmartInsightsList([])}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground font-medium mt-3 leading-relaxed">
                  {smartInsightsList[activeInsightIndex]?.description}
                </p>

                <div className="mt-3 flex items-start gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/10 text-xs">
                  <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-foreground/90 font-semibold leading-snug">
                    <span className="font-extrabold text-primary">Recommendation: </span>
                    {smartInsightsList[activeInsightIndex]?.recommendation}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex items-center gap-4 bg-white dark:bg-slate-900 px-6 py-4 rounded-[2.5rem] border border-border shadow-sm">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <LayoutDashboard className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Clinical Intelligence Engine</p>
                  <p className="text-xs text-muted-foreground">Run intelligence check to generate 5 deep clinical, queue, peak hour, and demographic insights.</p>
                </div>
              </div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              className={cn(
                "rounded-[1.5rem] text-[11px] h-12 px-6 font-black uppercase tracking-widest gap-2 bg-primary text-white hover:bg-primary/90 transition-all shadow-lg active:scale-95",
                isAnalyzing && "opacity-60 cursor-not-allowed"
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
              {isAnalyzing ? "Analyzing Clinic Data..." : "Run Intelligence Check"}
            </Button>
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

        {/* Main Patient Flow Dynamics - Full Width Hero Feature Card */}
        <Card className="w-full border-none shadow-sm bg-card overflow-hidden group hover:shadow-md transition-all duration-300 rounded-[2rem] p-6 lg:p-8 flex flex-col justify-between">
          {/* Header with Title & Filter Controls */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-5 border-b border-border/50">
            {/* Left Side: Title & Badges */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-extrabold tracking-tight text-foreground">Patient Flow Dynamics</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
                    {flowScale} View
                  </span>
                  {zoomLevel > 1 && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50 flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" />
                      {zoomLevel === 2 ? 'Zoom 1.8x' : 'Zoom 3.3x'}
                    </span>
                  )}
                </div>
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  {flowMetrics.rangeDescription} • <span className="text-emerald-600 dark:text-emerald-400 font-bold">Today isolated to live panel</span>
                </p>
              </div>
            </div>

            {/* Right Side: Zoom Controls + Scale Switcher + Timeframe Buttons + Custom Date Range */}
            <div className="flex flex-wrap items-center gap-2.5 self-stretch xl:self-auto justify-between xl:justify-end">
              {/* Stock-style Zoom Controls (Groww/Zerodha style) */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-all"
                  title="Zoom Out (Broader scale: D → W → M)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-black px-2 text-muted-foreground select-none">
                  {zoomLevel === 1 ? '1x' : zoomLevel === 2 ? '2x' : '3x'}
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-all"
                  title="Zoom In (Finer scale: M → W → D)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel > 1 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-slate-900 rounded-lg transition-all ml-0.5 border-l border-border/40 pl-1.5"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="h-6 w-[1px] bg-border/60 hidden sm:block mx-0.5" />

              {/* Stock-style Scale Switcher [ D ] [ W ] [ M ] */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => { setFlowScale('daily'); setZoomLevel(1); }}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all",
                    flowScale === 'daily'
                      ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Daily Scale"
                >
                  D
                </button>
                <button
                  type="button"
                  onClick={() => { setFlowScale('weekly'); setZoomLevel(1); }}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all",
                    flowScale === 'weekly'
                      ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Weekly Scale"
                >
                  W
                </button>
                <button
                  type="button"
                  onClick={() => { setFlowScale('monthly'); setZoomLevel(1); }}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all",
                    flowScale === 'monthly'
                      ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Monthly Scale"
                >
                  M
                </button>
              </div>

              <div className="h-6 w-[1px] bg-border/60 hidden sm:block mx-0.5" />

              {/* Preset Timeframe Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-border/60">
                {(['7d', '30d', '90d', '1y'] as FlowTimeRange[]).map((range) => {
                  const label = range === '7d' ? '7D' : range === '30d' ? '30D' : range === '90d' ? '90D' : '1Y';
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => {
                        setFlowTimeRange(range);
                        setZoomLevel(1);
                        if (range === '7d' || range === '30d') setFlowScale('daily');
                        else if (range === '90d') setFlowScale('weekly');
                        else if (range === '1y') setFlowScale('monthly');
                      }}
                      className={cn(
                        "px-3 py-1 text-[11px] font-black uppercase rounded-lg transition-all",
                        flowTimeRange === range
                          ? "bg-white dark:bg-slate-900 text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Range Popover */}
              <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={flowTimeRange === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      "h-8 rounded-xl text-xs font-extrabold gap-1.5 px-3 border-border/60 shadow-none",
                      flowTimeRange === 'custom' && "bg-primary text-white"
                    )}
                  >
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>{flowTimeRange === 'custom' ? 'Custom Range' : 'Custom'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-84 p-4 rounded-2xl shadow-2xl border-border/70" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <span className="text-xs font-black uppercase tracking-wider text-foreground">Custom Date Range</span>
                      <span className="text-[10px] text-muted-foreground font-semibold">Auto-scales D / W / M</span>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2">Quick Presets</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { label: 'Last 14D', days: 14, scale: 'daily' as FlowScale },
                          { label: 'Last 60D', days: 60, scale: 'weekly' as FlowScale },
                          { label: 'Last 6M', days: 180, scale: 'weekly' as FlowScale },
                          { label: 'Last 1Y', days: 365, scale: 'monthly' as FlowScale },
                          { label: 'Last 2Y', days: 730, scale: 'monthly' as FlowScale },
                          { label: 'Last 3Y', days: 1095, scale: 'monthly' as FlowScale },
                        ].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              const end = new Date();
                              const start = subDays(end, preset.days);
                              setCustomStartDate(format(start, 'yyyy-MM-dd'));
                              setCustomEndDate(format(end, 'yyyy-MM-dd'));
                              setFlowScale(preset.scale);
                              setFlowTimeRange('custom');
                              setZoomLevel(1);
                              setCustomPopoverOpen(false);
                            }}
                            className="px-2 py-1.5 text-[11px] font-bold rounded-lg border border-border/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-center transition-all"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Start / End inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">From</label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="h-8 text-xs font-bold rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">To</label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="h-8 text-xs font-bold rounded-xl"
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full h-8 text-xs font-extrabold rounded-xl bg-primary text-white"
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          const d1 = new Date(customStartDate);
                          const d2 = new Date(customEndDate);
                          const diffDays = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
                          if (diffDays <= 35) setFlowScale('daily');
                          else if (diffDays <= 180) setFlowScale('weekly');
                          else setFlowScale('monthly');
                          setFlowTimeRange('custom');
                          setZoomLevel(1);
                          setCustomPopoverOpen(false);
                        }
                      }}
                    >
                      Apply Date Range
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Main Content: Full-Width Sharp Stock Line Chart */}
          <div className="w-full h-[360px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayedVolumeData} margin={{ top: 15, right: 25, bottom: 20, left: -15 }}>
                <defs>
                  <linearGradient id="sharpFlowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.35} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700 }}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#2563eb', strokeWidth: 1, strokeDasharray: '3 3' }} />

                {/* Subtle Gradient Area Underneath Sharp Line */}
                <Area
                  type="linear"
                  dataKey="patients"
                  fill="url(#sharpFlowGradient)"
                  stroke="none"
                  isAnimationActive={true}
                />

                {/* Main Sharp-Edged Patient Flow Line (Groww / Zerodha Linear Style) */}
                <Line
                  type="linear"
                  dataKey="patients"
                  stroke="#2563eb"
                  strokeWidth={2.75}
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                  dot={{
                    r: displayedVolumeData.length > 25 ? 2.5 : 4.5,
                    fill: '#ffffff',
                    stroke: '#2563eb',
                    strokeWidth: 2
                  }}
                  activeDot={{
                    r: 6.5,
                    fill: '#2563eb',
                    stroke: '#ffffff',
                    strokeWidth: 3
                  }}
                  isAnimationActive={true}
                />

                {/* Distinct High-Contrast Amber Dashed Reference Line for Average */}
                {displayedVolumeData.length > 0 && flowMetrics.completedPeriodAvg > 0 && (
                  <ReferenceLine
                    y={flowMetrics.completedPeriodAvg}
                    stroke="#f59e0b"
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    strokeOpacity={0.9}
                  >
                    <Label
                      value={`Avg: ${flowMetrics.completedPeriodAvg} ${flowScale === 'daily' ? 'pts/day' : flowScale === 'weekly' ? 'pts/wk' : 'pts/mo'}`}
                      position="insideTopRight"
                      fill="#d97706"
                      fontSize={11}
                      fontWeight={900}
                      offset={12}
                    />
                  </ReferenceLine>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Spacious Horizontal Stats Row Directly Underneath the Chart ("keela theliva") */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 mt-2 border-t border-border/50">
            {/* 1. Today Live Panel (Emerald Green) */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/25 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  Live Today
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Ongoing
                </span>
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-3xl font-black text-foreground tracking-tight">
                  {flowMetrics.todayLiveCount}
                </span>
                <span className="text-xs font-bold text-muted-foreground">patients today</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Tracked live. Excluded from historical average so ongoing hours do not drag down completed stats.
              </p>
            </div>

            {/* 2. Completed Historical Average (Amber Gold Accent Matching Dashed Line) */}
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-300/70 dark:border-amber-900/60 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-black tracking-wider text-amber-700 dark:text-amber-400">
                  {flowScale === 'daily' ? 'Completed Daily Avg' : flowScale === 'weekly' ? 'Weekly Flow Avg' : 'Monthly Flow Avg'}
                </span>
                <span className="h-2 w-8 border-b-2 border-dashed border-amber-500 inline-block" />
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-3xl font-black text-amber-700 dark:text-amber-400 tracking-tight">
                  {flowMetrics.completedPeriodAvg}
                </span>
                <span className="text-xs font-bold text-amber-600/80 dark:text-amber-400/80">
                  {flowScale === 'daily' ? 'patients / day' : flowScale === 'weekly' ? 'patients / wk' : 'patients / mo'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Matches orange dashed line across {flowMetrics.completedDaysCount} completed {flowScale === 'daily' ? 'days' : 'periods'}.
              </p>
            </div>

            {/* 3. Period Peak & Low */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-border/70 shadow-2xs flex flex-col justify-between">
              <div className="text-[11px] uppercase font-black tracking-wider text-muted-foreground mb-1.5">
                Period High & Low
              </div>
              <div className="grid grid-cols-2 gap-2.5 my-1">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> Peak
                  </div>
                  <div className="font-black text-foreground text-base mt-0.5">{flowMetrics.periodPeak.count} pts</div>
                  <div className="text-[10px] text-muted-foreground truncate">{flowMetrics.periodPeak.label}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5" /> Low
                  </div>
                  <div className="font-black text-foreground text-base mt-0.5">{flowMetrics.periodLow.count} pts</div>
                  <div className="text-[10px] text-muted-foreground truncate">{flowMetrics.periodLow.label}</div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Highest and lowest patient volume in selected range.
              </p>
            </div>

            {/* 4. Total Volume in Period */}
            <div className="p-4 rounded-2xl bg-primary/5 dark:bg-primary/10 border border-primary/15 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-black tracking-wider text-primary">
                  Completed Period Total
                </span>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2 my-1">
                <span className="text-3xl font-black text-foreground tracking-tight">
                  {flowMetrics.periodTotal}
                </span>
                <span className="text-xs font-bold text-muted-foreground">total visits</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Cumulative completed patient encounters across {flowMetrics.rangeDescription}.
              </p>
            </div>
          </div>
        </Card>

        {/* Row 1: Diagnosis Mix (Left) & Patient Diversity (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer
            title="Diagnosis Mix"
            description={selectedDiagnoses.length > 0 ? "Selected Clinical Reasons" : "Top 6 Clinical Reasons"}
            icon={<Stethoscope className="w-5 h-5" />}
            height={220}
            footer={
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-border/40">
                {filteredDiagnosisData.map((d, i) => (
                  <div key={d.name} className="flex flex-col gap-0.5 overflow-hidden p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[10px] font-black uppercase text-muted-foreground truncate tracking-tight" title={d.name}>{d.name}</span>
                    </div>
                    <span className="text-base font-black pl-3.5 leading-none text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            }
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
                innerRadius={55}
                outerRadius={80}
                paddingAngle={6}
                dataKey="value"
                animationDuration={1500}
                animationEasing="ease-out"
              >
                {filteredDiagnosisData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} cornerRadius={5} />)}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
          </ChartContainer>

          {/* Operational: Sex Ratio (Patient Diversity) */}
          <ChartContainer
            title="Patient Diversity"
            description="Sex Ratio Breakdown"
            icon={<UserRound className="w-5 h-5" />}
            height={220}
            footer={
              <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-border/40">
                {demographics.sex.map((s, i) => (
                  <div key={s.name} className="flex flex-col gap-0.5 overflow-hidden p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border/40">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: i === 0 ? '#3b82f6' : i === 1 ? '#ec4899' : '#10b981' }} />
                      <span className="text-[10px] font-black uppercase text-muted-foreground truncate tracking-tight">{s.name}</span>
                    </div>
                    <span className="text-base font-black pl-3.5 leading-none text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            }
          >
            <PieChart>
              <Pie
                data={demographics.sex}
                cx="50%"
                cy="50%"
                stroke="none"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
              >
                {demographics.sex.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : i === 1 ? '#ec4899' : '#10b981'} />)}
              </Pie>
              <RechartsTooltip content={<CustomTooltip />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Row 2: Patient Demographics (Age-based categorization - Standalone) */}
        <div className="w-full">
          <ChartContainer
            title="Patient Demographics"
            description="Age-based clinical cohort distribution"
            icon={<Users className="w-5 h-5" />}
          >
            <BarChart data={demographics.age} layout="vertical" margin={{ top: 10, right: 30, left: 50, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 800 }}
                width={140}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} barSize={26} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Row 3: Appointment Loads (Time-based distribution - Standalone) */}
        <div className="w-full">
          <ChartContainer
            title="Appointment Loads"
            description="Hourly Patient Arrival Distribution (00:00 to 24:00)"
            icon={<Clock className="w-5 h-5" />}
            extra={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                    { id: 'all', label: 'All Time' }
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setAppointmentLoadRange(r.id as any)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all",
                        appointmentLoadRange === r.id
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {appointmentLoadRange === 'today' ? `Today: ${appointmentLoadsTotal.toLocaleString()} Patients` : `Total: ${appointmentLoadsTotal.toLocaleString()} Patients`}
                </span>
                <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {appointmentLoadRange === 'today' 
                    ? `Pace: ~${loadPeriodStats.activeHoursAvg} pts / active hr` 
                    : `Daily Avg: ~${loadPeriodStats.dailyAvg} pts / day`}
                </span>
              </div>
            }
            topSlot={
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                    <span>Inspect Time Window:</span>
                  </div>

                  {/* From Hour */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground">From</span>
                    <Select value={String(customStartHour)} onValueChange={v => setCustomStartHour(parseInt(v))}>
                      <SelectTrigger className="h-8 w-24 text-xs font-bold rounded-lg border-border bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {HOUR_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)} className="text-xs font-bold">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* To Hour */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-muted-foreground">To</span>
                    <Select value={String(customEndHour)} onValueChange={v => setCustomEndHour(parseInt(v))}>
                      <SelectTrigger className="h-8 w-24 text-xs font-bold rounded-lg border-border bg-card">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {HOUR_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)} className="text-xs font-bold">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quick Presets */}
                  <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-border/50">
                    {[
                      { label: 'OPD Rush (10-14)', start: 10, end: 14 },
                      { label: 'Evening Peak (17-21)', start: 17, end: 21 },
                      { label: 'Full Shift (08-20)', start: 8, end: 20 },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => { setCustomStartHour(preset.start); setCustomEndHour(preset.end); }}
                        className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-md transition-all",
                          customStartHour === preset.start && customEndHour === preset.end
                            ? "bg-amber-500 text-white shadow-xs"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Computed Average for Selected Window */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs font-bold">
                    <span className="text-muted-foreground">In Window ({customWindowStats.duration} hrs):</span>
                    <span className="font-black text-foreground">{customWindowStats.count} patients ({customWindowStats.percent}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white shadow-sm text-xs font-bold">
                    <span>Window Average:</span>
                    <span className="font-black text-sm">~{customWindowStats.avgPerHour} pts / hr</span>
                  </div>
                  {appointmentLoadRange !== 'today' && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-sm text-xs font-bold">
                      <span>Daily Avg:</span>
                      <span className="font-black text-sm">~{customWindowStats.avgPerDay} pts / day</span>
                    </div>
                  )}
                </div>
              </div>
            }
            footer={
              <div className="space-y-3 mt-4 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                      Time Period Flow & Averages
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {appointmentLoadRange === 'today' ? 'Hourly Pace' : 'Daily Pace'}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-muted-foreground">
                    Peak Period: <span className="font-black text-amber-600 dark:text-amber-400">{loadPeriodStats.peakPeriodName}</span> ({loadPeriodStats.peakPeriodCount} pts)
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Morning Card */}
                  <div className={cn(
                    "p-3 rounded-2xl border transition-all relative overflow-hidden",
                    loadPeriodStats.peakPeriodName.includes('Morning') 
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" 
                      : "bg-slate-50 dark:bg-slate-900/50 border-border/40"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🌅</span>
                        <span className="text-xs font-bold text-foreground">Morning</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">06:00 - 12:00</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-xl font-black text-foreground">{loadPeriodStats.morning.count}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">patients</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground ml-auto">
                        {loadPeriodStats.morning.percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium mt-1">
                      {appointmentLoadRange === 'today' ? (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.morning.avgPerHour}</strong> pts/hr</span>
                      ) : (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.morning.avgPerDay}</strong> pts/day</span>
                      )}
                    </div>
                  </div>

                  {/* Afternoon Card */}
                  <div className={cn(
                    "p-3 rounded-2xl border transition-all relative overflow-hidden",
                    loadPeriodStats.peakPeriodName.includes('Afternoon') 
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" 
                      : "bg-slate-50 dark:bg-slate-900/50 border-border/40"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">☀️</span>
                        <span className="text-xs font-bold text-foreground">Afternoon</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">12:00 - 17:00</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-xl font-black text-foreground">{loadPeriodStats.afternoon.count}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">patients</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground ml-auto">
                        {loadPeriodStats.afternoon.percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium mt-1">
                      {appointmentLoadRange === 'today' ? (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.afternoon.avgPerHour}</strong> pts/hr</span>
                      ) : (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.afternoon.avgPerDay}</strong> pts/day</span>
                      )}
                    </div>
                  </div>

                  {/* Evening Card */}
                  <div className={cn(
                    "p-3 rounded-2xl border transition-all relative overflow-hidden",
                    loadPeriodStats.peakPeriodName.includes('Evening') 
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" 
                      : "bg-slate-50 dark:bg-slate-900/50 border-border/40"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🌇</span>
                        <span className="text-xs font-bold text-foreground">Evening</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">17:00 - 21:00</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-xl font-black text-foreground">{loadPeriodStats.evening.count}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">patients</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground ml-auto">
                        {loadPeriodStats.evening.percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium mt-1">
                      {appointmentLoadRange === 'today' ? (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.evening.avgPerHour}</strong> pts/hr</span>
                      ) : (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.evening.avgPerDay}</strong> pts/day</span>
                      )}
                    </div>
                  </div>

                  {/* Night Card */}
                  <div className={cn(
                    "p-3 rounded-2xl border transition-all relative overflow-hidden",
                    loadPeriodStats.peakPeriodName.includes('Night') 
                      ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500/20" 
                      : "bg-slate-50 dark:bg-slate-900/50 border-border/40"
                  )}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🌙</span>
                        <span className="text-xs font-bold text-foreground">Night</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">21:00 - 06:00</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-xl font-black text-foreground">{loadPeriodStats.night.count}</span>
                      <span className="text-[11px] font-bold text-muted-foreground">patients</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground ml-auto">
                        {loadPeriodStats.night.percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-medium mt-1">
                      {appointmentLoadRange === 'today' ? (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.night.avgPerHour}</strong> pts/hr</span>
                      ) : (
                        <span>Avg: <strong className="text-foreground font-black">{loadPeriodStats.night.avgPerDay}</strong> pts/day</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            <AreaChart data={peakHoursData} margin={{ top: 20, right: 30, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="hour"
                ticks={HOUR_TICKS_24}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
                tickFormatter={(val) => `${val}`}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              {/* Highlight the user-selected time window on the chart */}
              {customStartHour < customEndHour ? (
                <ReferenceArea 
                  x1={customWindowStats.startLabel} 
                  x2={customWindowStats.endLabel} 
                  stroke="#f59e0b" 
                  strokeOpacity={0.5} 
                  strokeDasharray="3 3" 
                  fill="#f59e0b" 
                  fillOpacity={0.12} 
                />
              ) : customStartHour > customEndHour ? (
                <>
                  <ReferenceArea 
                    x1={customWindowStats.startLabel} 
                    x2="24:00" 
                    stroke="#f59e0b" 
                    strokeOpacity={0.5} 
                    strokeDasharray="3 3" 
                    fill="#f59e0b" 
                    fillOpacity={0.12} 
                  />
                  <ReferenceArea 
                    x1="00:00" 
                    x2={customWindowStats.endLabel} 
                    stroke="#f59e0b" 
                    strokeOpacity={0.5} 
                    strokeDasharray="3 3" 
                    fill="#f59e0b" 
                    fillOpacity={0.12} 
                  />
                </>
              ) : null}
              {parseFloat(loadPeriodStats.activeHoursAvg) > 0 && (
                <ReferenceLine 
                  y={parseFloat(loadPeriodStats.activeHoursAvg)} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  label={{ 
                    value: `Avg (${loadPeriodStats.activeHoursAvg}/hr)`, 
                    fill: '#f59e0b', 
                    fontSize: 10, 
                    fontWeight: 800, 
                    position: 'insideTopRight' 
                  }} 
                />
              )}
              <Area
                type="monotone"
                dataKey="patients"
                name="Patients"
                stroke="#f59e0b"
                fill="url(#peakGradient)"
                strokeWidth={3}
              />
            </AreaChart>
          </ChartContainer>
        </div>

        {/* Row 4: Patient Acquisition & Retention Dynamics (New vs Returning) - Full Width */}
        <div className="w-full">
          <ChartContainer
            title="Patient Retention & Acquisition"
            description="First-Time Registrations vs Returning Follow-Up Encounters"
            icon={<UserCheck className="w-5 h-5" />}
            extra={
              retentionData.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground hidden sm:inline">Latest Retention Rate:</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {retentionData[retentionData.length - 1]?.retentionRate}% Returning
                  </span>
                </div>
              )
            }
          >
            <BarChart data={retentionData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis
                dataKey="monthLabel"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fontWeight: 800, fill: 'hsl(var(--foreground))' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 700 }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '16px' }}
                iconType="circle"
              />
              <Bar
                name="New Patients"
                dataKey="newPatients"
                fill="#3b82f6"
                stackId="flow"
                radius={[0, 0, 4, 4]}
                barSize={42}
              />
              <Bar
                name="Returning Patients"
                dataKey="returningPatients"
                fill="#10b981"
                stackId="flow"
                radius={[8, 8, 0, 0]}
                barSize={42}
              />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Row 5: Disease Seasonality Chart - Full Width */}
        <div className="w-full">
          <ChartContainer
            title="Clinical Seasonality"
            description={selectedSeasonalityDiagnoses.length > 0 ? "Custom Diagnosis Comparison (6-Month Trend)" : "6-Month Trend Analysis of Core Diagnoses"}
            icon={<Activity className="w-5 h-5" />}
            extra={
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 relative">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    {selectedSeasonalityDiagnoses.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] font-black flex items-center justify-center">
                        {selectedSeasonalityDiagnoses.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 rounded-2xl shadow-2xl" align="end">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <h4 className="text-xs font-black uppercase tracking-widest">Filter Diagnosis</h4>
                    {selectedSeasonalityDiagnoses.length > 0 && (
                      <button onClick={() => setSelectedSeasonalityDiagnoses([])} className="text-[10px] font-black text-primary hover:underline uppercase">Reset</button>
                    )}
                  </div>
                  <ScrollArea className="h-[250px] pr-3">
                    <div className="space-y-2.5">
                      {allSeasonalityDiagnoses.map((d) => (
                        <div key={d.name} className="flex items-center space-x-2 group">
                          <Checkbox
                            id={`seasonality-diag-${d.name}`}
                            checked={selectedSeasonalityDiagnoses.includes(d.name)}
                            onCheckedChange={() => toggleSeasonalityDiagnosis(d.name)}
                          />
                          <label htmlFor={`seasonality-diag-${d.name}`} className="text-xs font-bold leading-none cursor-pointer group-hover:text-primary transition-colors flex-1 flex justify-between">
                            <span className="truncate pr-2">{d.name}</span>
                            <span className="text-muted-foreground tabular-nums">{d.count}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            }
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
  );
}