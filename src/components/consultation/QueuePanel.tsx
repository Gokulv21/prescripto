import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatAge } from '@/lib/utils';
import { Loader2, RefreshCw, Users, Bell, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface QueuePanelProps {
  queue: any[];
  isLoadingQueue: boolean;
  refetchQueue: () => void;
  selectedVisit: any;
  selectVisit: (visit: any, checkForDrafts?: boolean) => void;
  onCallPatient: (visit: any) => void;
  onRemoveVisit?: (visit: any) => void;
}

export default function QueuePanel({
  queue,
  isLoadingQueue,
  refetchQueue,
  selectedVisit,
  selectVisit,
  onCallPatient,
  onRemoveVisit,
}: QueuePanelProps) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const getStatusColor = (s: string) => {
    if (s === 'waiting') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
    if (s === 'in_consultation') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50';
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Math.floor((now - new Date(createdAt).getTime()) / 60000);
    if (diff < 1) return 'just in';
    if (diff < 60) return `${diff}m wait`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins}m wait`;
  };

  const checkVitalsAlerts = (visit: any) => {
    const alerts = [];
    if (visit.spo2 !== null && visit.spo2 !== undefined && visit.spo2 < 95 && visit.spo2 > 0) {
      alerts.push({ type: 'spo2', label: `SpO₂: ${visit.spo2}%`, critical: visit.spo2 < 90 });
    }
    if (visit.temperature !== null && visit.temperature !== undefined && visit.temperature > 100.4) {
      alerts.push({ type: 'temp', label: `Temp: ${visit.temperature}°F`, critical: visit.temperature > 102 });
    }
    if (visit.blood_pressure) {
      const parts = visit.blood_pressure.split('/');
      if (parts.length === 2) {
        const sys = parseInt(parts[0]);
        const dia = parseInt(parts[1]);
        if (sys > 140 || dia > 90) {
          alerts.push({ type: 'bp', label: `BP: ${visit.blood_pressure}`, critical: sys > 160 || dia > 100 });
        }
      }
    }
    return alerts;
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="p-4 border-b border-border bg-card sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Patient Queue
          </h2>
          {queue.length > 0 ? (
            <p className="text-sm text-muted-foreground">{queue.length} patients today</p>
          ) : (
            <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-bold">Queue is Empty</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={refetchQueue} disabled={isLoadingQueue} className="h-8 w-8 rounded-full overflow-hidden">
          <motion.div
            animate={isLoadingQueue ? { rotate: 360 } : { rotate: 0 }}
            transition={isLoadingQueue ? { repeat: Infinity, duration: 1, ease: "linear" } : { type: "spring", stiffness: 500, damping: 30 }}
          >
            {isLoadingQueue ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </motion.div>
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {queue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No patients waiting in queue.</p>
          </div>
        ) : (
          queue.map(visit => {
            const vitalsAlerts = checkVitalsAlerts(visit);
            return (
              <div
                key={visit.id}
                onClick={() => selectVisit(visit, true)}
                className={cn(
                  "w-full p-3 rounded-xl border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer flex flex-col gap-2",
                  selectedVisit?.id === visit.id && "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/50 shadow-sm"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-heading font-black text-sm",
                      selectedVisit?.id === visit.id ? "bg-blue-600 text-white shadow-md shadow-blue-500/10" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}>
                      #{visit.token_number}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {(visit.patients?.title ? visit.patients.title + ' ' : '') + visit.patients?.name}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-muted-foreground">
                          {formatAge(visit.patients)} · {visit.patients?.sex}
                        </span>
                        {visit.status === 'waiting' && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {getWaitTime(visit.created_at)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-5 font-black uppercase tracking-wider", getStatusColor(visit.status))}>
                      {visit.status === 'waiting' ? 'Wait' : visit.status === 'in_consultation' ? 'Active' : 'Done'}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallPatient(visit);
                      }}
                      className="h-8 w-8 hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/30 rounded-xl"
                      title="Call Patient"
                    >
                      <Bell className="w-4 h-4 animate-pulse" />
                    </Button>
                    {onRemoveVisit && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          const name = `${visit.patients?.title ? visit.patients.title + ' ' : ''}${visit.patients?.name || 'this patient'}`;
                          if (window.confirm(`Remove ${name} from queue and delete test visit?`)) {
                            onRemoveVisit(visit);
                          }
                        }}
                        className="h-8 w-8 hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/30 rounded-xl"
                        title="Remove from Queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Vitals Warnings Banner */}
                {vitalsAlerts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pl-12">
                    {vitalsAlerts.map((alert, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 border",
                          alert.critical 
                            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-900/50"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-900/50"
                        )}
                      >
                        <AlertTriangle className={cn("w-3 h-3", alert.critical ? "text-red-500 animate-bounce" : "text-amber-500")} />
                        {alert.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

