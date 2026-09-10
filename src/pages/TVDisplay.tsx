import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { 
  Building2, Users, Volume2, VolumeX, Maximize, Minimize, 
  Clock, Activity, Sparkles, AlertCircle, RefreshCw, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

// Soft single-tone startup ping (confirms audio is active when TV opens)
function playStartupPing() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    ctx.resume().then(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5 — soft, pleasant
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  } catch (e) {}
}

// Play a pleasant two-tone hospital chime using Web Audio API
function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    
    // First tone (G5 - 784Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second tone (C6 - 1046Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.50, now + 0.25);
    gain2.gain.setValueAtTime(0.4, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 1.2);
  } catch (err) {
    console.warn('[TVDisplay] Audio chime blocked or unsupported:', err);
  }
}

export default function TVDisplay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const prevActiveTokenRef = useRef<number | null>(null);
  const startupPingPlayedRef = useRef(false);

  // Auto-unlock AudioContext + play startup ping to confirm audio is active
  useEffect(() => {
    const playOnceIfAudioEnabled = () => {
      if (startupPingPlayedRef.current) return;
      startupPingPlayedRef.current = true;
      playStartupPing();
    };

    // Try immediately (works if page was already interacted with)
    setTimeout(() => {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const testCtx = new AudioContext();
          if (testCtx.state === 'running') {
            playOnceIfAudioEnabled();
          } else {
            testCtx.resume().then(() => playOnceIfAudioEnabled()).catch(() => {});
          }
        }
      } catch (e) {}
    }, 600);

    // Fallback: play on first user interaction if autoplay was blocked
    const onFirstInteraction = () => playOnceIfAudioEnabled();
    window.addEventListener('click', onFirstInteraction, { once: true });
    window.addEventListener('touchstart', onFirstInteraction, { once: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', onFirstInteraction);
      window.removeEventListener('touchstart', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Clinic Info
  const { data: clinic, isLoading: isLoadingClinic } = useQuery({
    queryKey: ['tvClinic', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('slug', slug)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch Active & Waiting Queue
  const { data: queue = [], refetch: refetchQueue } = useQuery({
    queryKey: ['tvQueue', clinic?.id],
    enabled: !!clinic?.id,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('visits')
        .select('*, patients(*)')
        .eq('clinic_id', clinic?.id)
        .in('status', ['waiting', 'in_consultation'])
        .gte('created_at', `${today}T00:00:00`)
        .order('token_number', { ascending: true });

      if (error) throw error;
      return data || [];
    }
  });

  // Realtime subscription for visits
  useEffect(() => {
    if (!clinic?.id) return;

    const channel = supabase
      .channel(`tv_display_${clinic.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: `clinic_id=eq.${clinic.id}`
        },
        () => {
          refetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, refetchQueue]);

  const activeVisit = queue.find((v: any) => v.status === 'in_consultation');
  const waitingVisits = queue.filter((v: any) => v.status === 'waiting');

  // Trigger chime sound when new patient is actively called
  useEffect(() => {
    if (activeVisit?.token_number && activeVisit.token_number !== prevActiveTokenRef.current) {
      if (isAudioEnabled) {
        playChimeSound();
      }
      prevActiveTokenRef.current = activeVisit.token_number;
    }
  }, [activeVisit?.token_number, isAudioEnabled]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getPatientDisplayName = (p: any) => {
    if (!p) return 'Patient';
    const title = p.title ? `${p.title} ` : '';
    return `${title}${p.name || 'Patient'}`;
  };

  if (isLoadingClinic) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <Activity className="w-12 h-12 text-blue-500 animate-spin" />
        <h2 className="text-xl font-bold tracking-wider uppercase text-slate-400">Loading Clinic Display...</h2>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4 font-sans p-6 text-center">
        <Building2 className="w-16 h-16 text-red-500" />
        <h1 className="text-3xl font-black">Clinic Not Found</h1>
        <p className="text-slate-400 text-sm">Please verify the clinic address: /{slug}/display</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-white font-sans flex flex-col overflow-hidden select-none">
      {/* 1. Responsive Header Bar */}
      <header className="h-14 sm:h-16 md:h-20 border-b border-slate-800/80 px-3 sm:px-5 md:px-8 flex items-center justify-between bg-slate-900/80 backdrop-blur-2xl shrink-0 gap-2 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {clinic.photo_url ? (
            <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg shadow-cyan-500/20 bg-slate-800 shrink-0">
              <img
                src={clinic.photo_url}
                alt={clinic.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 sm:w-11 sm:h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 md:w-7 md:h-7 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg md:text-2xl font-black tracking-tight text-white truncate">{clinic.name}</h1>
            <div className="hidden sm:flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-400">
              <p className="uppercase tracking-widest flex items-center gap-1.5 text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Queue
              </p>
              {clinic.phone && (
                <span className="hidden lg:inline-block text-slate-500">• Tel: {clinic.phone}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Back button — hidden in fullscreen */}
          {!isFullscreen && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate(-1)}
              className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200"
              title="Go Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="px-2.5 sm:px-4 md:px-5 py-1.5 md:py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center gap-1.5 sm:gap-2 shadow-inner">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-cyan-400" />
            <span className="font-mono text-xs sm:text-base md:text-xl font-black text-slate-100 tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setIsAudioEnabled(!isAudioEnabled);
              if (!isAudioEnabled) playChimeSound();
            }}
            className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            title={isAudioEnabled ? "Mute Chime" : "Enable Audio Chime"}
          >
            {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-slate-400" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="h-8 w-8 sm:h-9 sm:w-9 md:h-11 md:w-11 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />}
          </Button>
        </div>
      </header>

      {/* 2. Responsive Main Display Area */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 md:gap-6 lg:gap-8 min-h-0 overflow-hidden">
        {/* Left Column: Now Calling / Active Consultation */}
        <section className="md:col-span-8 flex flex-col justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            {activeVisit ? (
              <motion.div
                key={activeVisit.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4 }}
                className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-blue-900/40 via-slate-900/80 to-slate-900 border-2 border-cyan-500/30 p-4 sm:p-6 md:p-8 lg:p-12 flex flex-col items-center justify-center text-center shadow-2xl shadow-cyan-500/10 overflow-hidden"
              >
                {/* Visual Glow Effect */}
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

                <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-3 sm:px-5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-3 sm:mb-5 rounded-full animate-pulse">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5 inline" /> Now Consulting
                </Badge>

                <div className="my-1 sm:my-3 md:my-4">
                  <span className="text-slate-400 text-xs sm:text-base md:text-xl font-bold uppercase tracking-widest block mb-1 sm:mb-2">Token Number</span>
                  <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-[8rem] xl:text-[9rem] leading-none font-black font-mono tracking-tighter bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300 bg-clip-text text-transparent drop-shadow-2xl">
                    #{activeVisit.token_number}
                  </h2>
                </div>

                <div className="mt-2 sm:mt-4 space-y-1 sm:space-y-2 max-w-xl">
                  <p className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-white tracking-wide">
                    {getPatientDisplayName(activeVisit.patients)}
                  </p>
                  <p className="text-xs sm:text-sm md:text-base font-bold text-slate-400">
                    Please proceed to the Doctor&apos;s Consultation Room
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="rounded-2xl sm:rounded-3xl bg-slate-900/50 border border-slate-800/80 p-5 sm:p-8 md:p-10 lg:p-16 flex flex-col items-center justify-center text-center relative overflow-hidden">
                {clinic.photo_url ? (
                  <div className="relative mb-6 group">
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-[2.5rem] blur-xl opacity-75" />
                    <div className="relative w-32 h-20 sm:w-48 sm:h-28 md:w-64 md:h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800">
                      <img
                        src={clinic.photo_url}
                        alt={clinic.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 rounded-full bg-slate-800/60 flex items-center justify-center mb-4 sm:mb-6 text-slate-500">
                    <Users className="w-6 h-6 sm:w-8 sm:h-8 md:w-12 md:h-12" />
                  </div>
                )}
                <h3 className="text-base sm:text-xl md:text-3xl font-black text-slate-200 mb-2">Doctor Preparing Next Consultation</h3>
                <p className="text-slate-400 text-xs sm:text-sm md:text-lg font-bold max-w-md">
                  Please take a seat. Your token number will appear here shortly.
                </p>
                {clinic.address && (
                  <p className="text-slate-500 text-xs font-semibold mt-4">
                    📍 {clinic.address}
                  </p>
                )}
              </div>
            )}
          </AnimatePresence>
        </section>

        {/* Right Column: Upcoming Queue (Responsive for Mobile & Tablets) */}
        <section className="md:col-span-4 flex flex-col bg-slate-900/40 border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 md:p-5 overflow-hidden">
          <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-slate-800">
            <h3 className="text-sm sm:text-base md:text-lg font-black tracking-wide text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Upcoming Queue
            </h3>
            <Badge variant="outline" className="text-[10px] sm:text-xs font-mono font-bold bg-slate-800 text-slate-300 border-slate-700">
              {waitingVisits.length} Waiting
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {waitingVisits.length > 0 ? (
              waitingVisits.slice(0, 10).map((visit: any, index: number) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 md:p-4 rounded-xl bg-slate-900/80 border border-slate-800/60 transition-all hover:border-cyan-500/30"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg bg-slate-800 border border-slate-700/70 flex items-center justify-center font-mono font-black text-sm sm:text-base md:text-lg text-cyan-300 shrink-0">
                      #{visit.token_number}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs sm:text-sm md:text-base text-slate-200 truncate">
                        {getPatientDisplayName(visit.patients)}
                      </p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        #{index + 1} in line
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-400 border-none font-bold text-[9px] sm:text-[10px] shrink-0 ml-2">
                    Next
                  </Badge>
                </div>
              ))
            ) : (
              <div className="h-full py-6 flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <Users className="w-7 h-7 sm:w-9 sm:h-9 mb-2 opacity-40" />
                <p className="text-[10px] sm:text-xs font-bold">No patients waiting</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* 3. Responsive Footer Announcement Banner */}
      <footer className="min-h-[2.5rem] bg-slate-900/90 border-t border-slate-800/80 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between text-[11px] sm:text-xs font-bold text-slate-400 shrink-0 gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>Prescripto Clinical Display System</span>
        </div>
        <div>
          {isAudioEnabled ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Audio Chime Active
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1 cursor-pointer hover:underline" onClick={() => setIsAudioEnabled(true)}>
              <AlertCircle className="w-3.5 h-3.5" /> Tap speaker icon to unmute audio
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
