import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Bell, Check, X, Loader2, Eye, EyeOff, ShieldCheck, PhoneCall, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function NotificationCenter() {
  const { user, roles, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetModal, setResetModal] = useState<{ open: boolean, request: any | null }>({ open: false, request: null });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [systemNotifications, setSystemNotifications] = useState<any[]>([]);

  const playChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playTone = (freq: number, startTime: number, duration: number, type: 'sine' | 'triangle' | 'square' = 'triangle') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Quick attack and quick decay for a sharp, loud alarm alert
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.8, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      // Loud, distinct 4-pulse medical cabin pager alarm (beep-beep ... beep-beep)
      playTone(987.77, now, 0.15, 'triangle');        // B5 (sharp)
      playTone(987.77, now + 0.2, 0.15, 'triangle');  // B5
      
      playTone(1318.51, now + 0.45, 0.15, 'triangle'); // E6 (higher pitch)
      playTone(1318.51, now + 0.65, 0.25, 'triangle'); // E6
    } catch (e) {
      console.error("Audio playback error:", e);
    }
  };


  const isSuper = roles.includes('superadmin');
  const isOwner = roles.includes('owner');
  const isDoctor = roles.includes('doctor');
  const clinicId = profile?.clinic_id;

  const fetchRequests = async () => {
    if (!isSuper && !isOwner && !isDoctor) return;
    
    // Fetch all pending requests and filter client-side for maximum reliability and simplicity,
    // which aligns with Row Level Security (RLS) policies.
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching password reset requests:", error);
      return;
    }

    const filtered = (data || []).filter(req => {
      if (isSuper) {
        // Super Admin sees clinic owner requests (and doctor requests as fallback/legacy)
        if (req.requester_role === 'owner' || req.requester_role === 'doctor') {
          return true;
        }
      }
      if (isOwner || isDoctor) {
        // Clinic owners/doctors see staff and doctor requests for their clinic
        if (req.clinic_id === clinicId && (req.requester_role === 'staff' || req.requester_role === 'doctor')) {
          return true;
        }
      }
      return false;
    });

    setRequests(filtered);
  };

  const fetchSystemNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (!error) setSystemNotifications(data || []);
  };

  useEffect(() => {
    fetchRequests();
    fetchSystemNotifications();
    
    // Subscribe to password resets
    const channelResets = supabase
      .channel('password_resets')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'password_reset_requests'
      }, () => fetchRequests())
      .subscribe();

    // Subscribe to system notifications
    const channelNotifs = supabase
      .channel('system_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`
      }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          playChime();
        }
        fetchSystemNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelResets);
      supabase.removeChannel(channelNotifs);
    };
  }, [clinicId, isSuper, isOwner, isDoctor, user?.id]);


  const handleApprove = (req: any) => {
    setResetModal({ open: true, request: req });
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('password_reset_requests')
      .update({ status: 'rejected' })
      .eq('id', id);
    
    if (error) toast.error('Failed to reject request');
    else {
      toast.success('Request rejected');
      fetchRequests();
    }
  };

  const submitReset = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          userId: resetModal.request.user_id, 
          newPassword,
          requestId: resetModal.request.id
        }
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setResetModal({ open: false, request: null });
      fetchRequests();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  // Permanently delete a single notification from DB
  const dismissNotification = async (id: string) => {
    setSystemNotifications(prev => prev.filter(n => n.id !== id)); // optimistic
    await supabase.from('notifications').delete().eq('id', id);
  };

  // Permanently delete ALL notifications for this user
  const deleteAllNotifications = async () => {
    setSystemNotifications([]); // optimistic
    await supabase.from('notifications').delete().eq('user_id', user?.id);
  };

  const totalCount = requests.length + systemNotifications.length;

  if (!user) return null;


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative group hover:bg-primary/5 transition-all rounded-full h-10 w-10">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
            {totalCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] p-2 glass-thick border-primary/20 shadow-2xl rounded-2xl mt-2 overflow-hidden">
          <div className="px-3 py-2 border-b border-primary/5 mb-2 flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-widest text-slate-500">Notifications</span>
            <div className="flex items-center gap-2">
              {totalCount > 0 && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[10px]">{totalCount} new</Badge>}
              {systemNotifications.length > 0 && (
                <button
                  onClick={deleteAllNotifications}
                  className="text-[9px] font-black text-slate-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-0.5 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Clear all
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-1 max-h-[400px] overflow-auto no-scrollbar">
            {systemNotifications.length > 0 && (
              <div className="mb-2">
                {systemNotifications.map(notif => (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "p-3 rounded-xl transition-all border border-transparent mb-1 relative group",
                      notif.is_read 
                        ? "opacity-60" 
                        : notif.title === 'CALLING PATIENT'
                          ? "bg-red-500/10 dark:bg-red-500/10 border-red-500/30 animate-pulse"
                          : "bg-blue-500/5 dark:bg-blue-400/5 border-blue-500/10"
                    )}
                  >
                    {/* Unread indicator bar */}
                    {!notif.is_read && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-600 rounded-full" />}

                    {/* Dismiss ✕ button — always visible on hover, always clickable */}
                    <button
                      onClick={() => dismissNotification(notif.id)}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete notification"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="flex flex-col gap-1 pr-5">
                      <p className={cn(
                        "text-[11px] font-black uppercase tracking-tight flex items-center gap-1.5",
                        notif.title === 'CALLING PATIENT' ? "text-red-500" :
                        notif.type === 'error' ? "text-red-600" : 
                        notif.type === 'success' ? "text-emerald-600" : "text-blue-600"
                      )}>
                        {notif.title === 'CALLING PATIENT' && <PhoneCall className="w-3.5 h-3.5 text-red-500 animate-pulse shrink-0" />}
                        {notif.title}
                      </p>
                      <p className="text-[11px] font-medium text-slate-900 dark:text-white leading-tight">
                        {notif.message}
                      </p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Password Reset Requests */}
            {requests.length > 0 && (
              <div className="pt-2 border-t border-primary/5">
                <p className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Access Requests</p>
                {requests.map(req => (
                  <div key={req.id} className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/10 group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">{req.email}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Requested Password Reset <span className="font-bold text-primary uppercase text-[9px]">({req.requester_role})</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(req)}
                        className="h-7 text-[10px] px-3 bg-primary/10 text-primary hover:bg-primary hover:text-white border-none shadow-none font-black uppercase tracking-wider"
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleReject(req.id)}
                        className="h-7 text-[10px] px-3 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 font-black uppercase tracking-wider"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {requests.length === 0 && systemNotifications.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-2">
                <Bell className="w-8 h-8 opacity-10 mb-2" />
                No pending notifications
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resetModal.open} onOpenChange={(open) => !open && setResetModal({ open: false, request: null })}>
        <DialogContent className="sm:max-w-[400px] glass-thick border-primary/20 rounded-3xl overflow-hidden p-0">
          <div className="bg-primary/5 p-6 border-b border-primary/10 flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <DialogTitle className="text-xl font-black tracking-tight">Security Review</DialogTitle>
                <DialogDescription>
                  Reset password for {resetModal.request?.email} <span className="font-semibold uppercase text-xs">({resetModal.request?.requester_role})</span>
                </DialogDescription>
             </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest font-black text-slate-500">New Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10 h-11 border-primary/10 focus-visible:ring-primary/20 bg-background/50"
                  placeholder="Enter new password"
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest font-black text-slate-500">Confirm Password</Label>
              <Input
                type={showPass ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 border-primary/10 focus-visible:ring-primary/20 bg-background/50"
                placeholder="Repeat password"
              />
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50/50 dark:bg-white/5 gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setResetModal({ open: false, request: null })} className="font-bold">Cancel</Button>
            <Button 
               onClick={submitReset} 
               disabled={saving || !newPassword || newPassword !== confirmPassword}
               className="font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
