import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Target, Wallet, Zap, FolderKanban, Brain } from 'lucide-react';

interface ScoreBreakdown {
  total_score: number;
  execution: { score: number; rate: number };
  financial: { score: number; rate: number };
  habits: { score: number; rate: number };
  projects: { score: number; rate: number };
  clarity: { score: number; rate: number };
}

interface ScoreCardProps {
  breakdown: ScoreBreakdown | null;
  loading?: boolean;
}

const pillars = [
  { key: 'execution', label: 'Execução', icon: Zap, query: 'Analise meu pilar de Execução' },
  { key: 'financial', label: 'Financeiro', icon: Wallet, query: 'Analise meu pilar Financeiro' },
  { key: 'habits', label: 'Hábitos', icon: Target, query: 'Analise meu pilar de Hábitos' },
  { key: 'projects', label: 'Projetos', icon: FolderKanban, query: 'Analise meu pilar de Projetos' },
  { key: 'clarity', label: 'Clareza', icon: Brain, query: 'Analise meu pilar de Clareza Mental' },
];

export function ScoreCard({ breakdown, loading }: ScoreCardProps) {
  const navigate = useNavigate();

  const getScoreColor = (score: number) => {
    if (score >= 700) return 'text-emerald-500';
    if (score >= 400) return 'text-yellow-500';
    return 'text-destructive';
  };

  const handlePillarClick = (query: string) => {
    navigate(`/chat?message=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cyan-500/10" />
        <CardContent className="p-6 relative">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-24 bg-muted rounded mx-auto" />
            <div className="h-16 w-32 bg-muted rounded mx-auto" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-3 bg-muted rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cyan-500/10" />
        <CardContent className="p-6 relative text-center">
          <p className="text-muted-foreground">Score indisponível</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cyan-500/10" />
      <CardContent className="p-6 relative">
        {/* Main Score */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground font-medium">Axiom Score</p>
          <p className={`text-6xl font-bold tracking-tight ${getScoreColor(breakdown.total_score)}`}>
            {breakdown.total_score}
          </p>
          <p className="text-xs text-muted-foreground">/1000</p>
        </div>

        {/* Pillar Breakdown */}
        <div className="space-y-3">
          {pillars.map(({ key, label, icon: Icon, query }) => {
            const pillar = breakdown[key as keyof typeof breakdown] as { score: number; rate: number };
            const percentage = (pillar.score / 200) * 100;
            
            return (
              <button
                key={key}
                onClick={() => handlePillarClick(query)}
                className="w-full flex items-center gap-3 group hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors tap-card"
              >
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs w-20 text-left text-muted-foreground group-hover:text-foreground transition-colors">
                  {label}
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-12 text-right">
                  {pillar.score}/200
                </span>
              </button>
            );
          })}
        </div>

        {/* Tip */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Clique em um pilar para análise detalhada
        </p>
      </CardContent>
    </Card>
  );
}
