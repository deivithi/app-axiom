import * as React from "react";
import { cn } from "@/lib/utils";

interface AppleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 1 | 2 | 3;
  interactive?: boolean;
  glow?: boolean;
  variant?: "default" | "score" | "metric" | "chart";
  scoreLevel?: "high" | "medium" | "low";
}

const AppleCard = React.forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, elevation = 2, interactive = false, glow = false, variant = "default", scoreLevel, children, ...props }, ref) => {
    const baseClasses = "apple-card";
    
    const elevationClasses = {
      1: "apple-card-1",
      2: "apple-card-2",
      3: "apple-card-3",
    };

    const variantClasses = {
      default: "",
      score: cn("score-card", scoreLevel),
      metric: "metric-card",
      chart: "chart-card",
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          elevationClasses[elevation],
          variantClasses[variant],
          interactive && "interactive cursor-pointer",
          glow && "glow-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AppleCard.displayName = "AppleCard";

// Metric Card Component
interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: "default" | "success" | "warning" | "error" | "info";
  interactive?: boolean;
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
        className={cn("p-4", className)}
        onClick={onClick}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="metric-label">{label}</p>
            <p className={cn("metric-value", colorClasses[color])}>{value}</p>
            {trend && (
              <p className={cn("text-xs font-medium", trend.positive ? "text-emerald-500" : "text-red-500")}>
                {trend.positive ? "↑" : "↓"} {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          {icon && (
            <div className={cn("metric-icon", iconBgClasses[color])}>
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
interface ChartCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  ({ className, title, subtitle, action, children, ...props }, ref) => {
    return (
      <AppleCard ref={ref} elevation={2} className={cn("p-6", className)} {...props}>
        <div className="chart-header">
          <div>
            <h3 className="chart-title">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
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
