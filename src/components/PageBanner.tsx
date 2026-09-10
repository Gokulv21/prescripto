import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageBannerProps {
  title: string;
  description: string;
  imageSrc: string;
  className?: string;
  children?: React.ReactNode;
}

export default function PageBanner({ 
  title, 
  description, 
  imageSrc, 
  className,
  children 
}: PageBannerProps) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl mb-6 group border border-slate-200/60 dark:border-slate-800/60 rounded-2xl md:rounded-3xl shadow-xs", className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent z-10" />
      
      <motion.div 
        initial={{ scale: 1.05, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute right-0 top-0 h-full w-full md:w-3/4 z-0"
      >
        <img 
          src={imageSrc} 
          alt={title} 
          className="w-full h-full object-cover object-right-top md:object-center grayscale-[0.2] dark:grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700 opacity-60"
        />
      </motion.div>
      
      {/* Dark Mode Overlay */}
      <div className="absolute inset-0 bg-black/5 dark:bg-black/30 z-[5] pointer-events-none" />

      <div className="relative z-20 px-5 py-6 md:px-8 md:py-7 max-w-5xl mx-auto flex flex-col justify-center min-h-[100px] md:min-h-[120px]">
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-1 drop-shadow-xs">
            {title}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm max-w-xl font-medium leading-relaxed">
            {description}
          </p>
        </motion.div>
        
        {children && (
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6"
          >
            {children}
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-border via-border/50 to-transparent z-30" />
    </div>
  );
}
