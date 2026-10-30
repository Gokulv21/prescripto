import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Stethoscope, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [website, setWebsite] = useState(''); // Honeypot field
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return; // Silent trap
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      toast.error('Invalid credentials');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 animate-in fade-in duration-500">
      <Card className="w-full max-w-md border-primary/20 shadow-2xl glassmorphism overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
        <CardHeader className="text-center space-y-6 pt-10">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-foreground/20 flex items-center justify-center shadow-inner relative group">
            <div className="absolute inset-0 rounded-2xl bg-primary blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
            <Stethoscope className="w-10 h-10 text-primary-foreground relative z-10" />
          </div>
          <div>
            <div className="flex items-center justify-center gap-2">
              <CardTitle className="text-3xl font-heading font-black tracking-tight">Prescripto</CardTitle>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">by Zevox</span>
            </div>
            <CardDescription className="text-sm font-semibold text-muted-foreground/80 mt-1">
              Hospital Management System • A Product of Zevox
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10 px-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="hidden" aria-hidden="true">
              <Input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your username"
                className="h-12 border-primary/10 focus-visible:ring-primary/30 transition-shadow"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={async () => {
                    if (!email.trim()) {
                      toast.error('Please enter your username/email first');
                      return;
                    }
                    const loadingToast = toast.loading('Sending request to administrator...');
                    try {
                      // Find user to get clinic_id
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('user_id, clinic_id, is_superadmin')
                        .eq('email', email.trim())
                        .maybeSingle();

                      if (!profile) {
                        toast.error('User not found');
                        return;
                      }

                      // SECURITY: Block internal reset requests for Super Admins
                      if (profile.is_superadmin) {
                        toast.error('System administrators must use platform secure recovery.');
                        return;
                      }

                      // Fetch roles to determine requester_role
                      const { data: userRoles } = await supabase
                        .from('user_roles')
                        .select('role')
                        .eq('user_id', profile.user_id);
                      
                      const rolesList = (userRoles || []).map(r => r.role);
                      let requesterRole = 'staff';
                      if (rolesList.includes('owner')) {
                        requesterRole = 'owner';
                      } else if (rolesList.includes('doctor')) {
                        requesterRole = 'doctor';
                      }

                      const { error: reqError } = await supabase
                        .from('password_reset_requests')
                        .insert({
                          user_id: profile.user_id,
                          clinic_id: profile.clinic_id,
                          email: email.trim(),
                          requester_role: requesterRole,
                          status: 'pending'
                        });

                      if (reqError) throw reqError;
                      
                      if (requesterRole === 'owner') {
                        toast.success('Reset request sent to Super Administrator');
                      } else {
                        toast.success('Reset request sent to your clinic administrator');
                      }
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to send request');
                    } finally {
                      toast.dismiss(loadingToast);
                    }
                  }}
                  className="text-xs font-bold text-primary hover:underline transition-all"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 border-primary/10 focus-visible:ring-primary/30 transition-shadow"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-13 text-lg font-semibold shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Sign In
            </Button>

            <div className="text-center pt-2 space-y-2 border-t border-border/40">
               <p className="text-xs text-muted-foreground font-medium">
                 Administrative locked system. Request access if needed.
               </p>
               <div className="flex items-center justify-center gap-3 text-xs font-bold text-primary">
                 <button
                   type="button"
                   onClick={() => navigate('/contact')}
                   className="hover:underline flex items-center gap-1"
                 >
                   Contact Zevox Support
                 </button>
               </div>
               <p className="text-[10px] text-muted-foreground font-semibold">
                 © 2026 Zevox Enterprise Systems. All rights reserved.
               </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

