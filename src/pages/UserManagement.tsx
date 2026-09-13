import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Loader2, Shield, RefreshCw, Trash2, Users, Crown, Stethoscope, ClipboardList, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { AppRole } from '@/lib/auth';
import { registerClient } from '@/lib/supabase-auth-admin';
import { useOutletContext } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Clinic } from '@/types/clinic';

export default function UserManagement() {
  const { clinic } = useOutletContext<{ clinic: Clinic }>();
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('staff');
  const [creating, setCreating] = useState(false);

  // Dynamic page title
  useEffect(() => {
    document.title = `Team Management${clinic?.name ? ` — ${clinic.name}` : ''} | Prescripto`;
    return () => { document.title = 'Prescripto'; };
  }, [clinic?.name]);

  const fetchUsers = async () => {
    try {
      const [{ data: profilesData, error: profError }] = await Promise.all([
        supabase.from('profiles').select('*').eq('clinic_id', clinic?.id).neq('is_superadmin', true)
      ]);
      if (profError) throw profError;
      const merged = (profilesData || []).map(p => {
        const displayName = (p?.full_name && p.full_name !== 'Staff Member') ? p.full_name : (p?.email || 'Staff Member');
        return {
          id: p.user_id,
          registration_id: p.id || 'NO-ROLE',
          full_name: displayName,
          email: p?.email || 'No email synced',
          role: p?.role || null
        };
      });
      setUsers(merged);
    } catch (err: any) {
      toast.error("Failed to load staff list");
    }
  };

  useEffect(() => {
    if (clinic?.id) fetchUsers();
  }, [clinic?.id]);

  const createUser = async () => {
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    try {
      const { data: allowed } = await supabase.rpc('check_rate_limit', {
        p_identifier: clinic?.id || 'global',
        p_bucket: 'create-user',
        p_max_requests: 10,
        p_interval_seconds: 3600
      });
      if (allowed === false) throw new Error('Rate limit reached. Try again later.');

      const { data, error } = await registerClient.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } }
      });
      if (error) throw error;
      if (!data.user) throw new Error('User creation failed');

      const { error: roleError } = await supabase.from('user_roles').insert({ user_id: data.user.id, role: role as AppRole });
      if (roleError) throw roleError;

      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        id: data.user.id,
        role: role as AppRole,
        clinic_id: clinic?.id
      });
      if (profileError) console.error("Profile Error:", profileError);

      toast.success(`${fullName} registered as ${role}`);
      setEmail(''); setPassword(''); setFullName('');
      fetchUsers();
    } catch (err: any) {
      if (err.message?.includes('already registered')) {
        toast.warning("User already exists. Check the list to Activate if they're missing a role.");
        fetchUsers();
      } else {
        toast.error(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const assignMissingRole = async (userId: string, name: string) => {
    const t = toast.loading(`Assigning role to ${name}...`);
    try {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'staff' as AppRole });
      if (error) throw error;
      toast.success(`Role assigned to ${name}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      toast.dismiss(t);
    }
  };

  const deleteUserAccount = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this clinic?`)) return;
    const t = toast.loading(`Removing ${name}...`);
    try {
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
      if (profileError) throw profileError;
      const { error: roleError } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (roleError) throw roleError;
      toast.success(`${name} removed`);
      fetchUsers();
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      toast.dismiss(t);
    }
  };

  const roleConfig: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
    owner: { label: 'Owner', icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800/50' },
    doctor: { label: 'Doctor', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800/50' },
    staff: { label: 'Staff', icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/50' },
  };

  const getRoleConfig = (r: string) => roleConfig[r] || { label: r, icon: Users, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' };

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">

      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">User Management</h1>
            <p className="text-xs text-muted-foreground font-bold">{clinic?.name || 'Clinic'} · Staff Access Control</p>
          </div>
        </div>
      </motion.div>

      {/* Create Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="relative overflow-hidden rounded-[1.75rem] border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 dark:from-blue-950/20 dark:via-slate-900 dark:to-indigo-950/20 shadow-xl shadow-blue-500/10 backdrop-blur-sm"
      >
        {/* decorative top stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />
        
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 dark:bg-blue-500/20">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-extrabold text-[15px] text-foreground">Register Staff Account</h2>
              <p className="text-[11px] text-muted-foreground font-medium">Only administrators can create clinic accounts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Full Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Dr. John Smith"
                className="h-11 rounded-xl border-blue-200/60 dark:border-blue-800/40 bg-white/80 dark:bg-slate-900/60 focus:ring-2 focus:ring-blue-500/30 font-semibold placeholder:font-normal placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Username (Email)</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="staff@clinic.com"
                className="h-11 rounded-xl border-blue-200/60 dark:border-blue-800/40 bg-white/80 dark:bg-slate-900/60 focus:ring-2 focus:ring-blue-500/30 font-semibold placeholder:font-normal placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Initial Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="h-11 rounded-xl border-blue-200/60 dark:border-blue-800/40 bg-white/80 dark:bg-slate-900/60 focus:ring-2 focus:ring-blue-500/30 font-semibold placeholder:font-normal placeholder:text-muted-foreground/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Assigned Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="h-11 rounded-xl border-blue-200/60 dark:border-blue-800/40 bg-white/80 dark:bg-slate-900/60 focus:ring-2 focus:ring-blue-500/30 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-xl">
                  <SelectItem value="owner" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Clinic Owner <span className="text-muted-foreground font-normal text-xs">(Multi-Staff Access)</span></span>
                    </div>
                  </SelectItem>
                  <SelectItem value="doctor" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                      <span>Doctor <span className="text-muted-foreground font-normal text-xs">(Full Clinical Access)</span></span>
                    </div>
                  </SelectItem>
                  <SelectItem value="staff" className="rounded-lg">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Clinic Staff <span className="text-muted-foreground font-normal text-xs">(Entry & Print only)</span></span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={createUser}
            disabled={creating}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[11px] uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.01] active:scale-[0.98]"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Register Staff Member
          </Button>
        </div>
      </motion.div>

      {/* Staff List Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
        className="rounded-[1.75rem] border border-border bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Shield className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <h2 className="font-extrabold text-[14px]">Staff Members</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{users.length} account{users.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchUsers}
            className="h-8 gap-2 rounded-xl text-muted-foreground hover:text-foreground font-bold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="divide-y divide-border/50">
          <AnimatePresence>
            {users.map((u, i) => {
              const rc = getRoleConfig(u.role);
              const RoleIcon = rc.icon;
              return (
                <motion.div
                  key={u.id || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border', rc.bg, rc.border)}>
                      <RoleIcon className={cn('w-4.5 h-4.5', rc.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] text-foreground truncate">{u.full_name || 'Staff Member'}</p>
                      <p className="text-[11px] text-muted-foreground font-medium truncate">{u.email || 'No email'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {u.role ? (
                      <span className={cn('text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border', rc.bg, rc.color, rc.border)}>
                        {rc.label}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white rounded-full animate-pulse"
                        onClick={() => assignMissingRole(u.id, u.full_name)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />Activate
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={() => deleteUserAccount(u.id, u.full_name)}
                      title="Remove from clinic"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Users className="w-8 h-8 opacity-20" />
              <p className="text-sm font-bold opacity-50">No staff members yet</p>
              <p className="text-xs opacity-40">Use the form above to register your first staff member.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}