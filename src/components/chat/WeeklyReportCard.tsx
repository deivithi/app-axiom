import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  BarChart3, 
  Target,
  MessageSquare,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiomLogo from '@/assets/axiom-logo.png';

interface WeeklyReportCardProps {
  content: string;
  timestamp: string;
  isFullReport?: boolean;
}

export function WeeklyReportCard({ content, timestamp, isFullReport = false }: WeeklyReportCardProps) {
  const [expanded, setExpanded] = useState(isFullReport);
  const navigate = useNavigate();

  // Parse score from content
  const scoreMatch = content.match(/Score:\s*(\d+)\s*(📈|📉)\s*\(([+-]?\d+)\)/);
  const currentScore = scoreMatch ? parseInt(scoreMatch[1]) : null;
  const scoreChange = scoreMatch ? parseInt(scoreMatch[3]) : null;
  const isPositive = scoreChange !== null && scoreChange >= 0;

  // Parse week dates
  const weekMatch = content.match(/Semana\s+(\d{2}\/\d{2})\s+a\s+(\d{2}\/\d{2})/);
  const weekStart = weekMatch?.[1] || '';
  const weekEnd = weekMatch?.[2] || '';

  // Check if this is a summary card (first message) or full report
  const isSummaryCard = content.includes('Bom dia') && !content.includes('Relatório Completo');

  if (isSummaryCard && !expanded) {
    return (
      <div className="flex gap-3 justify-start">
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-primary/30">
          <img src={axiomLogo} alt="Axiom" className="w-full h-full object-cover" />
        </div>
        <Card className="max-w-md bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Axiom Insights</span>
              {weekStart && weekEnd && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {weekStart} - {weekEnd}
                </Badge>
              )}
            </div>

            {currentScore !== null && (
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl font-bold text-foreground">{currentScore}</div>
                {scoreChange !== null && (
                  <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
                    {isPositive ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    <span className="font-semibold">{isPositive ? '+' : ''}{scoreChange}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground mb-4">
              Seu relatório semanal está pronto. Quer ver a análise completa?
            </p>

            <div className="flex flex-wrap gap-2">
              <Button 
                size="sm" 
                onClick={() => setExpanded(true)}
                className="gap-1"
              >
                <ChevronDown className="h-4 w-4" />
                Análise Completa
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => navigate('/intelligence')}
                className="gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full report view
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-primary/30">
        <img src={axiomLogo} alt="Axiom" className="w-full h-full object-cover" />
      </div>
      <Card className="max-w-2xl bg-card/80 backdrop-blur-sm border-border">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">Relatório Semanal</span>
            </div>
            {isSummaryCard && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setExpanded(false)}
                className="gap-1"
              >
                <ChevronUp className="h-4 w-4" />
                Recolher
              </Button>
            )}
          </div>

          {/* Score display for full report */}
          {currentScore !== null && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-background/50">
              <div className="text-4xl font-bold text-foreground">{currentScore}</div>
              {scoreChange !== null && (
                <div className={`flex items-center gap-1 text-lg ${isPositive ? 'text-emerald-500' : 'text-destructive'}`}>
                  {isPositive ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                  <span className="font-semibold">{isPositive ? '+' : ''}{scoreChange}</span>
                </div>
              )}
              <span className="text-muted-foreground text-sm ml-2">pontos esta semana</span>
            </div>
          )}

          {/* Content - render as markdown-like sections */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content.split('\n').map((line, i) => {
              // Section headers
              if (line.startsWith('**') && line.endsWith('**')) {
                return (
                  <h4 key={i} className="text-foreground font-semibold mt-4 mb-2 flex items-center gap-2">
                    {line.replace(/\*\*/g, '')}
                  </h4>
                );
              }
              // Bullet points
              if (line.startsWith('•') || line.startsWith('-')) {
                return (
                  <p key={i} className="text-muted-foreground text-sm my-1 pl-2">
                    {line}
                  </p>
                );
              }
              // Numbered items
              if (/^\d+\./.test(line)) {
                return (
                  <p key={i} className="text-muted-foreground text-sm my-1 pl-2">
                    {line}
                  </p>
                );
              }
              // Questions (highlighted)
              if (line.includes('❓') || line.includes('Pergunta')) {
                return (
                  <div key={i} className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-foreground text-sm font-medium">
                      {line.replace('❓ **Pergunta da Semana:**', '').trim()}
                    </p>
                  </div>
                );
              }
              // Separator
              if (line === '---') {
                return <hr key={i} className="my-4 border-border" />;
              }
              // Regular paragraphs
              if (line.trim()) {
                return (
                  <p key={i} className="text-muted-foreground text-sm my-2">
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              }
              return null;
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate('/intelligence')}
              className="gap-1"
            >
              <Target className="h-4 w-4" />
              Ver Dashboard
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                const input = document.querySelector('textarea');
                if (input) {
                  input.focus();
                  input.placeholder = 'Responda a pergunta da semana ou faça outra...';
                }
              }}
              className="gap-1"
            >
              <MessageSquare className="h-4 w-4" />
              Responder
            </Button>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground/60 mt-3">
            {new Date(timestamp).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
