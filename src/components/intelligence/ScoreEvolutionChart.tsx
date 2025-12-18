import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, Calendar, Award, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';

interface ScoreHistoryItem {
  calculated_at: string;
  total_score: number;
}

interface ScoreEvolutionChartProps {
  history: ScoreHistoryItem[];
  loading?: boolean;
}

export function ScoreEvolutionChart({ history, loading }: ScoreEvolutionChartProps) {
  // Process and group data by day (take last score of each day)
  const { chartData, metrics } = useMemo(() => {
    if (!history || history.length === 0) {
      return { 
        chartData: [], 
        metrics: { current: 0, average: 0, best: 0, trend: 0 } 
      };
    }

    // Group by day and take the last score
    const groupedByDay = history.reduce((acc, item) => {
      const date = format(new Date(item.calculated_at), 'yyyy-MM-dd');
      acc[date] = item.total_score;
      return acc;
    }, {} as Record<string, number>);

    // Convert to array and sort by date
    const data = Object.entries(groupedByDay)
      .map(([date, score]) => ({
        date,
        displayDate: format(new Date(date), 'dd/MM', { locale: ptBR }),
        score,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate metrics
    const scores = data.map(d => d.score);
    const current = scores[scores.length - 1] || 0;
    const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const best = Math.max(...scores, 0);
    
    // Calculate trend (compare last 7 days avg vs previous 7 days avg)
    let trend = 0;
    if (scores.length >= 2) {
      const recentHalf = scores.slice(-Math.ceil(scores.length / 2));
      const olderHalf = scores.slice(0, Math.floor(scores.length / 2));
      const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
      const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length : recentAvg;
      trend = Math.round(recentAvg - olderAvg);
    }

    return { chartData: data, metrics: { current, average, best, trend } };
  }, [history]);

  // Calculate dynamic Y domain
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    const scores = chartData.map(d => d.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const padding = Math.max((maxScore - minScore) * 0.15, 20);
    return [Math.max(0, Math.floor(minScore - padding)), Math.ceil(maxScore + padding)];
  }, [chartData]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução do Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse w-full h-full bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = metrics.trend > 0 ? TrendingUp : metrics.trend < 0 ? TrendingDown : Minus;
  const trendColor = metrics.trend > 0 ? 'text-green-500' : metrics.trend < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução do Score (30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics Summary */}
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col items-center p-2 rounded-lg bg-primary/10">
            <Target className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs text-muted-foreground">Atual</span>
            <span className="text-lg font-bold text-foreground">{metrics.current}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted">
            <BarChart3 className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-xs text-muted-foreground">Média</span>
            <span className="text-lg font-bold text-foreground">{metrics.average}</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted">
            <TrendIcon className={`h-4 w-4 ${trendColor} mb-1`} />
            <span className="text-xs text-muted-foreground">Tendência</span>
            <span className={`text-lg font-bold ${trendColor}`}>
              {metrics.trend > 0 ? '+' : ''}{metrics.trend}
            </span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-amber-500/10">
            <Award className="h-4 w-4 text-amber-500 mb-1" />
            <span className="text-xs text-muted-foreground">Melhor</span>
            <span className="text-lg font-bold text-foreground">{metrics.best}</span>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="displayDate" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={11}
                domain={yDomain}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip 
                formatter={(value: number) => [`${value} pontos`, 'Score']}
                labelFormatter={(label) => `Data: ${label}`}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill="url(#scoreGradient)"
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: 'hsl(var(--primary))', strokeWidth: 2, fill: 'hsl(var(--background))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Calendar className="h-8 w-8 opacity-50" />
            <p className="text-sm">Continue usando para ver a evolução</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
