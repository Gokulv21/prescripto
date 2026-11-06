import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface PageBannerProps {
  title: string;
  description: string;
  imageSrc?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function PageBanner({ 
  title, 
  description, 
  className,
  children 
}: PageBannerProps) {
  return (
    <div className={cn("relative w-full pb-6 mb-6 border-b border-slate-200/80 dark:border-slate-800", className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <motion.div
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-2 max-w-xl"
        >
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium leading-relaxed">
            {description}
          </p>
        </motion.div>

        {children && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex justify-center md:justify-end shrink-0"
          >
            {children}
          </motion.div>
        )}
      </div>
    </div>
  );
}
