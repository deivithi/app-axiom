import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface AppleCardProps extends HTMLMotionProps<"div"> {
  elevation?: 1 | 2 | 3;
  interactive?: boolean;
  glow?: boolean;
  variant?: "default" | "score" | "metric" | "chart";
  scoreLevel?: "high" | "medium" | "low";
}

const AppleCard = React.forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, elevation = 2, interactive = false, glow = false, variant = "default", scoreLevel, children, ...props }, ref) => {
    const baseClasses = "relative overflow-hidden rounded-2xl border transition-colors";

    // Axiom Vision: Adaptação das elevações para M3 / Apple HIG
    const elevationClasses = {
      1: "bg-card/40 border-border/40 backdrop-blur-xl",
      2: "glass-sm",
      3: "glass-lg",
    };

    const variantClasses = {
      default: "",
      score: cn(
        scoreLevel === "high" && "border-success/30 bg-success/5 shadow-glow-success",
        scoreLevel === "medium" && "border-warning/30 bg-warning/5 shadow-glow-warning",
        scoreLevel === "low" && "border-error/30 bg-error/5 shadow-glow-error"
      ),
      metric: "",
      chart: "glass",
    };

    // Física Apple (Mola apertada, retorno rápido)
    const springTransition = { type: "spring", stiffness: 400, damping: 30 };

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        whileHover={interactive ? { y: -4, scale: 1.01 } : {}}
        whileTap={interactive ? { scale: 0.98 } : {}}
        className={cn(
          baseClasses,
          elevationClasses[elevation],
          variantClasses[variant],
          interactive && "cursor-pointer hover:border-primary/50",
          glow && "shadow-glass-surface",
          className
        )}
        {...props}
      >
        {/* Glow de fundo interno */}
        <div className="absolute inset-0 bg-gradient-glass-premium pointer-events-none" />
        {/* Camada superior do vidro (Brilho reflexivo sutil) */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

        <div className="relative z-10 w-full h-full">
          {children}
        </div>
      </motion.div>
    );
  }
);
AppleCard.displayName = "AppleCard";

// Metric Card Component
interface MetricCardProps extends Omit<AppleCardProps, "value"> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: "default" | "success" | "warning" | "error" | "info";
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, label, value, icon, trend, color = "default", interactive = false, onClick, ...props }, ref) => {
    const colorClasses = {
      default: "text-foreground",
      success: "text-emerald-500",
      warning: "text-amber-500",
      error: "text-red-500",
      info: "text-primary",
    };

    const iconBgClasses = {
      default: "bg-muted",
      success: "bg-emerald-500/10",
      warning: "bg-amber-500/10",
      error: "bg-red-500/10",
      info: "bg-primary/10",
    };

    return (
      <AppleCard
        ref={ref}
        elevation={1}
        interactive={interactive}
        className={cn("p-5", className)}
        onClick={onClick}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground tracking-tight">{label}</p>
            <motion.p
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className={cn("text-3xl font-semibold tracking-tighter", colorClasses[color])}
            >
              {value}
            </motion.p>
            {trend && (
              <p className={cn("text-xs font-medium flex items-center gap-1", trend.positive ? "text-emerald-500" : "text-red-500")}>
                <span className="text-[10px] bg-background/50 px-1 py-0.5 rounded backdrop-blur-md">
                  {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
                </span>
                <span className="text-muted-foreground/70">vs anterior</span>
              </p>
            )}
          </div>
          {icon && (
            <div className={cn("p-3 rounded-xl backdrop-blur-md border border-white/5", iconBgClasses[color])}>
              {icon}
            </div>
          )}
        </div>
      </AppleCard>
    );
  }
);
MetricCard.displayName = "MetricCard";

// Chart Card Component
interface ChartCardProps extends AppleCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  ({ className, title, subtitle, action, children, ...props }, ref) => {
    return (
      <AppleCard ref={ref} elevation={2} className={cn("p-6", className)} {...props}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium tracking-tight text-foreground">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </AppleCard>
    );
  }
);
ChartCard.displayName = "ChartCard";

export { AppleCard, MetricCard, ChartCard };
