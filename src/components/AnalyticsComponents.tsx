import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, Tooltip, TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  extra?: ReactNode;
  height?: number | string;
  footer?: ReactNode;
}

export const ChartContainer = ({ title, description, children, className, icon, extra, height = 300, footer }: ChartContainerProps) => (
  <Card className={cn("border-none shadow-sm bg-card overflow-hidden group hover:shadow-md transition-all duration-300 rounded-[2rem]", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/50">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <CardTitle className="text-base font-bold tracking-tight text-foreground">{title}</CardTitle>
          {description && <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">{description}</p>}
        </div>
      </div>
      {extra}
    </CardHeader>
    <CardContent className="pt-6">
      <div className="w-full" style={{ height: typeof height === 'number' ? `${height}px` : height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
      {footer}
    </CardContent>
  </Card>
);

export const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    // Deduplicate entries by name to avoid repetition in ComposedCharts
    const uniquePayload = payload.reduce((acc: any[], current) => {
      const x = acc.find(item => item.name === current.name);
      if (!x) return acc.concat([current]);
      else return acc;
    }, []);

    return (
      <div className="bg-card/80 backdrop-blur-md border border-border p-3 rounded-2xl shadow-xl animate-in zoom-in-95 duration-200">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1.5 border-b border-border/50 pb-1">{label}</p>
        <div className="space-y-1">
          {uniquePayload.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-bold text-foreground">{item.name}:</span>
              </div>
              <span className="text-sm font-black text-primary">
                {item.value}
                {String(item.name).toLowerCase() === 'percentage' ? '%' : String(item.name).toLowerCase().includes('patient') ? ' patients' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export const MetricCard = ({ label, value, trend, icon, color, delay = 0 }: { label: string, value: string | number, trend?: string, icon: ReactNode, color: string, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
  >
    <Card className="border-none shadow-sm hover:shadow-lg transition-all duration-300 bg-card overflow-hidden group rounded-[2rem]">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3 shadow-inner", color)}>
            {icon}
          </div>
          {trend && (
            <div className="px-2.5 py-1 rounded-full bg-secondary/50 border border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              {trend}
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-0.5">{label}</p>
          <p className="text-4xl font-extrabold text-foreground tracking-tighter mt-1 tabular-nums group-hover:text-primary transition-colors">{value}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);
