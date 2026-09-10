import { ReactNode, useState, useRef, useEffect } from 'react';
import { useAuth, AppRole } from '@/lib/auth';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Stethoscope, ClipboardPlus, Printer, BarChart3, Users, LogOut, Home, Menu, HelpCircle, Sun, Moon, Monitor, ChevronDown, Info, Tv, User, LayoutGrid
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useTheme } from '@/components/ThemeProvider';
import logo from '@/assets/logo.png';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationCenter from './NotificationCenter';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Home className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Patient Entry', path: '/nurse', icon: <ClipboardPlus className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Consultation', path: '/consultation', icon: <Stethoscope className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Print Queue', path: '/print', icon: <Printer className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'TV Display', path: '/display', icon: <Tv className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Patients', path: '/patients', icon: <Users className="w-5 h-5" />, roles: ['doctor', 'staff', 'superadmin', 'owner'] },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'Profile', path: '/profile', icon: <User className="w-5 h-5" />, roles: ['doctor', 'superadmin', 'owner'] },
  { label: 'User Mgmt', path: '/users', icon: <Users className="w-5 h-5" />, roles: ['superadmin', 'owner'] },
  { label: 'About', path: '/about', icon: <Info className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
  { label: 'Help', path: '/help', icon: <HelpCircle className="w-5 h-5" />, roles: ['staff', 'doctor', 'superadmin', 'owner'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const { slug } = useParams();

  const handleMobileNav = (path: string) => {
    const isGlobal = path === '/help';
    const fullPath = (slug && !isGlobal) ? `/${slug}${path === '/' ? '/dashboard' : path}` : path;
    navigate(fullPath);
    setIsMobileMenuOpen(false);
  };

  const visibleItems = navItems.filter(item => item.roles.some(r => roles.includes(r)));

  const getFullPath = (itemPath: string) => {
    if (!slug || itemPath === '/help') return itemPath;
    if (itemPath === '/') return `/${slug}/dashboard`;
    return `/${slug}${itemPath}`;
  };

  // 4 Core Quick Nav Items (5th tab is the Menu/All Modules Hamburger)
  const mobileCoreTabs = [
    { label: 'Home', path: '/', icon: <Home className="w-5 h-5" /> },
    { label: 'Patients', path: '/patients', icon: <Users className="w-5 h-5" /> },
    { label: 'Entry', path: '/nurse', icon: <ClipboardPlus className="w-5 h-5" /> },
    { label: 'Consult', path: '/consultation', icon: <Stethoscope className="w-5 h-5" /> },
  ];

  const DOCK_POS_KEY = 'prescripto_mobile_dock_pos';

  const [dockPos, setDockPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(DOCK_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (e) {}
    return { x: 0, y: 0 };
  });

  const [isDraggingDock, setIsDraggingDock] = useState(false);

  const resetDockPosition = () => {
    setDockPos({ x: 0, y: 0 });
    try {
      localStorage.removeItem(DOCK_POS_KEY);
    } catch (e) {}
  };

  return (
    <div className="min-h-screen flex skynex-mesh-bg font-jakarta-sans relative overflow-x-hidden">
      {/* ── Desktop Fluid Sidebar ── */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarExpanded ? 250 : 84 }}
        onMouseEnter={() => setIsSidebarExpanded(true)}
        onMouseLeave={() => setIsSidebarExpanded(false)}
        className="hidden md:flex flex-col bg-white/75 dark:bg-slate-950/75 backdrop-blur-2xl sticky top-0 h-screen z-50 border-r border-slate-200/60 dark:border-slate-800/60 select-none overflow-hidden"
      >
        <div
          className={cn(
            "border-b border-slate-200/50 dark:border-slate-800/50 flex transition-all duration-300 overflow-hidden relative px-4 py-4",
            isSidebarExpanded ? "h-[88px] flex-row items-center justify-between" : "h-[110px] flex-col items-center justify-center gap-3"
          )}
        >
          <motion.div
            animate={{ x: 0 }}
            className="flex items-center gap-3.5 shrink-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 shadow-md flex items-center justify-center border border-slate-200/60 dark:border-slate-800 overflow-hidden">
              <img src={logo} className="w-7 h-7 object-contain" alt="Logo" />
            </div>
            <AnimatePresence>
              {isSidebarExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="whitespace-nowrap"
                >
                  <h2 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none">PreScripto</h2>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-1">{profile?.full_name}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(!isSidebarExpanded && "mt-1")}
          >
            <NotificationCenter />
          </motion.div>
        </div>

        {/* Sidebar Nav - Scrollable section */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar py-3">
          {visibleItems.map((item) => {
            const fullPath = getFullPath(item.path);
            const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));

            return (
              <button
                key={item.path}
                onMouseEnter={() => setHoveredItem(item.path)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => navigate(fullPath)}
                className={cn(
                  "w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 relative z-10",
                  isActive ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                {/* Active Highlight Pill */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-primary shadow-md shadow-primary/25 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}

                <div className="shrink-0 w-5 flex justify-center">{item.icon}</div>

                <AnimatePresence>
                  {isSidebarExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="font-bold tracking-tight"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {hoveredItem === item.path && !isActive && (
                  <motion.div
                    layoutId="sidebar-hover"
                    className="absolute inset-0 bg-slate-100 dark:bg-white/5 rounded-xl -z-20"
                    transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 mt-auto border-t border-slate-200/50 dark:border-slate-800/50 space-y-3 shrink-0">
          {/* Theme Toggle Capsule */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl relative">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all relative z-10",
                theme === 'light' ? "text-primary font-bold" : "text-slate-400"
              )}
              title="Light Mode"
            >
              {theme === 'light' && <motion.div layoutId="theme-active" className="absolute inset-0 bg-white shadow-xs rounded-lg" />}
              <Sun className="w-4 h-4 relative z-10" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-lg transition-all relative z-10",
                theme === 'dark' ? "text-primary font-bold" : "text-slate-400"
              )}
              title="Dark Mode"
            >
              {theme === 'dark' && <motion.div layoutId="theme-active" className="absolute inset-0 bg-slate-800 shadow-xs rounded-lg" />}
              <Moon className="w-4 h-4 relative z-10" />
            </button>
          </div>

          <button
            onClick={signOut}
            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-xs text-red-500 font-bold hover:bg-red-500/10 transition-all overflow-hidden"
          >
            <div className="shrink-0 w-5 flex justify-center"><LogOut className="w-4 h-4" /></div>
            {isSidebarExpanded && <span className="whitespace-nowrap uppercase tracking-wider text-[10px]">Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main Viewport (Clean & Compact) ── */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative h-screen">
        {/* ── Mobile Top Header (Profile Swapped to Top!) ── */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-white/75 dark:bg-slate-950/75 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-xs border border-slate-200/60 dark:border-slate-800 flex items-center justify-center overflow-hidden">
              <img src={logo} className="w-6 h-6 object-contain" alt="Logo" />
            </div>
            <span className="font-black text-base tracking-tight text-slate-900 dark:text-white">PreScripto</span>
          </div>

          <div className="flex items-center gap-2.5">
            <NotificationCenter />
            
            {/* Profile Avatar / Settings Button (Swapped from Bottom Nav) */}
            <button
              onClick={() => navigate(getFullPath('/profile'))}
              className={cn(
                "relative w-9 h-9 rounded-full bg-white dark:bg-slate-900 border flex items-center justify-center shadow-xs active:scale-90 transition-all overflow-hidden group",
                location.pathname.endsWith('/profile')
                  ? "ring-2 ring-primary border-primary"
                  : "border-slate-200/80 dark:border-slate-800"
              )}
              title="Doctor Profile & Settings"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-primary/20 to-purple-500/20 text-primary flex items-center justify-center font-black text-xs">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || <User className="w-4 h-4" />}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs" />
            </button>
          </div>
        </header>

        {/* Page Content Container */}
        <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-12 min-h-full">
          {children}
        </div>
      </main>

      {/* ── Apple VisionOS / iOS 18 Draggable Floating Glass Dock (Persisted Position) ── */}
      <motion.nav
        drag
        dragMomentum={false}
        dragElastic={0.06}
        dragConstraints={{
          left: -140,
          right: 140,
          top: -window.innerHeight + 120,
          bottom: 10
        }}
        initial={false}
        animate={{ x: dockPos.x, y: dockPos.y }}
        whileDrag={{ scale: 1.05, cursor: "grabbing" }}
        onDragStart={() => setIsDraggingDock(true)}
        onDragEnd={(_e, info) => {
          setTimeout(() => setIsDraggingDock(false), 80);
          const newPos = {
            x: dockPos.x + info.offset.x,
            y: dockPos.y + info.offset.y
          };
          setDockPos(newPos);
          try {
            localStorage.setItem(DOCK_POS_KEY, JSON.stringify(newPos));
          } catch (e) {}
        }}
        className="fixed bottom-4 inset-x-0 mx-auto z-50 flex md:hidden items-center justify-between w-[92vw] max-w-[370px] h-[62px] px-1.5 rounded-[2.25rem] bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border border-white/70 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.18)] select-none touch-none cursor-grab"
      >
        {/* Drag Indicator Pill (Double-tap to reset center) */}
        <div
          onDoubleClick={resetDockPosition}
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-7 h-1 rounded-full bg-slate-300 dark:bg-slate-700 opacity-60 hover:opacity-100 transition-opacity"
          title="Drag dock anywhere • Double-tap to reset position"
        />

        {mobileCoreTabs.map((item) => {
          const fullPath = getFullPath(item.path);
          const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));
          return (
            <button
              key={item.path}
              onClick={() => {
                if (!isDraggingDock) navigate(fullPath);
              }}
              className="flex-1 flex flex-col items-center justify-center py-1 select-none active:scale-90 transition-transform relative"
            >
              <div className={cn(
                "w-6 h-6 flex items-center justify-center transition-all duration-150",
                isActive ? "text-primary scale-110 drop-shadow-[0_0_8px_var(--accent-glow)]" : "text-slate-400 dark:text-slate-500"
              )}>
                {item.icon}
              </div>
              <span className={cn(
                "text-[10px] font-bold mt-0.5 leading-none transition-colors duration-150",
                isActive ? "text-slate-900 dark:text-white font-extrabold" : "text-slate-400 dark:text-slate-500"
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-[0_0_6px_var(--accent-glow)]" />
              )}
            </button>
          );
        })}

        {/* 5th Tab: Hamburger / All Modules Launcher (No Box, Instant) */}
        <button
          onClick={() => {
            if (!isDraggingDock) setIsMobileMenuOpen(true);
          }}
          className="flex-1 flex flex-col items-center justify-center py-1 select-none active:scale-90 transition-transform relative"
        >
          <div className={cn(
            "w-6 h-6 flex items-center justify-center transition-all duration-150",
            isMobileMenuOpen ? "text-primary scale-110 drop-shadow-[0_0_8px_var(--accent-glow)]" : "text-slate-400 dark:text-slate-500"
          )}>
            <LayoutGrid className="w-5 h-5" />
          </div>
          <span className={cn(
            "text-[10px] font-bold mt-0.5 leading-none transition-colors duration-150",
            isMobileMenuOpen ? "text-slate-900 dark:text-white font-extrabold" : "text-slate-400 dark:text-slate-500"
          )}>
            Menu
          </span>
          {isMobileMenuOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shadow-[0_0_6px_var(--accent-glow)]" />
          )}
        </button>
      </motion.nav>

      {/* ── Apple-Inspired Modernized "All Modules" Launcher Sheet (Zero-Scroll Compact) ── */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent
          side="bottom"
          className="p-0 border-0 bg-transparent shadow-none overflow-visible"
          style={{ height: 'auto', maxHeight: '90vh' }}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.5, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="mx-3 mb-3 rounded-[2rem] overflow-hidden border border-white/50 dark:border-white/10 shadow-[0_-15px_45px_rgba(0,0,0,0.35)] bg-white/95 dark:bg-slate-950/95 backdrop-blur-3xl"
          >
            {/* Grab Handle */}
            <div className="flex justify-center pt-2.5 pb-0.5">
              <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Launcher Header - Compact */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white shadow-xs">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">All Modules</h3>
                  <p className="text-[9px] text-primary font-bold uppercase tracking-wider">{profile?.full_name ?? 'Doctor'}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-full w-7 h-7 bg-slate-100 dark:bg-slate-800 active:scale-75 transition-transform"
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              </Button>
            </div>

            {/* Compact Grid - 4 Columns, Compact Icons - 100% Fits with ZERO Scrolling */}
            <div className="px-3 py-2.5 grid grid-cols-4 gap-1.5 overflow-hidden">
              {visibleItems.map((item) => {
                const fullPath = getFullPath(item.path);
                const isActive = location.pathname === fullPath || (item.path === '/' && location.pathname.endsWith('/dashboard'));
                return (
                  <button
                    key={item.path}
                    onClick={() => handleMobileNav(item.path)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all select-none active:scale-90",
                      isActive
                        ? "bg-primary/10 border border-primary/25"
                        : "bg-slate-100/60 dark:bg-white/[0.04] border border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-transform shrink-0",
                      isActive
                        ? "bg-gradient-to-tr from-primary to-purple-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50"
                    )}>
                      <div className="w-4 h-4">{item.icon}</div>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold text-center leading-tight truncate w-full",
                      isActive ? "text-primary font-black" : "text-slate-600 dark:text-slate-400"
                    )}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Apple-style Appearance Segment & Sign Out - Compact */}
            <div className="px-4 py-2.5 border-t border-slate-200/50 dark:border-slate-800/60 space-y-2 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">Theme</span>
                <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg border border-black/5 dark:border-white/5">
                  {[
                    { v: 'light', label: 'Light', icon: <Sun className="w-3 h-3" /> },
                    { v: 'dark', label: 'Dark', icon: <Moon className="w-3 h-3" /> },
                    { v: 'system', label: 'Auto', icon: <Monitor className="w-3 h-3" /> },
                  ].map(({ v, label, icon }) => (
                    <button
                      key={v}
                      onClick={() => setTheme(v as any)}
                      className={cn(
                        "px-2.5 py-0.5 flex items-center gap-1 rounded-md transition-all text-[9px] font-bold active:scale-95",
                        theme === v
                          ? "bg-white dark:bg-slate-700 text-primary shadow-xs"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs uppercase tracking-wider border border-red-500/20 active:scale-95 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
