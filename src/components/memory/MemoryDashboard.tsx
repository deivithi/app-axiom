import { useMemory, Memory } from '@/contexts/MemoryContext';
import { Brain, Clock, Target, Zap, Archive, Lightbulb, User, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const typeIcons: Record<string, any> = {
  personality: User,
  routine: Calendar,
  goal: Target,
  pattern: TrendingUp,
  preference: Zap,
  fact: Lightbulb,
  insight: Sparkles
};

const typeLabels: Record<string, string> = {
  personality: 'Personalidade',
  routine: 'Rotina',
  goal: 'Meta',
  pattern: 'Padrão',
  preference: 'Preferência',
  fact: 'Fato',
  insight: 'Insight'
};

const typeColors: Record<string, string> = {
  personality: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  routine: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  goal: 'bg-green-500/20 text-green-300 border-green-500/30',
  pattern: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  preference: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  fact: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  insight: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
};

function MemoryCard({ memory, onArchive }: { memory: Memory; onArchive: (id: string) => void }) {
  const Icon = typeIcons[memory.type] || Brain;
  const timeAgo = formatDistanceToNow(new Date(memory.created_at), { addSuffix: true, locale: ptBR });
  
  return (
    <div className="group p-3 rounded-lg bg-card/50 border border-border/50 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${typeColors[memory.type]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={`text-xs ${typeColors[memory.type]}`}>
              {typeLabels[memory.type]}
            </Badge>
            {memory.context?.confidence && (
              <span className="text-xs text-muted-foreground">
                {Array(memory.context.confidence).fill('★').join('')}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{memory.content}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
            {memory.usage_count > 0 && (
              <>
                <span>•</span>
                <span>Usado {memory.usage_count}x</span>
              </>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          onClick={() => onArchive(memory.id)}
        >
          <Archive className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export default function MemoryDashboard() {
  const { activeContext, learningInsights, totalMemories, isLoading, archiveMemory } = useMemory();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const allMemories = [
    ...learningInsights.goals,
    ...learningInsights.patterns,
    ...learningInsights.facts,
    ...learningInsights.insights,
    ...learningInsights.personality,
    ...learningInsights.routine,
    ...learningInsights.preferences
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      {/* Context Overview */}
      <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="w-5 h-5 text-primary" />
            Contexto Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {activeContext.length > 0 ? (
              activeContext.map((topic) => (
                <Badge key={topic} variant="secondary" className="bg-primary/20 text-primary-foreground">
                  {topic}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum contexto ativo ainda. Converse com Axiom para criar memórias!
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Archive className="w-4 h-4" />
              <span>{totalMemories} memórias</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Insights by Category */}
      {learningInsights.goals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-green-400" />
              Metas & Objetivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {learningInsights.goals.slice(0, 5).map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} onArchive={archiveMemory} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {learningInsights.patterns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Padrões Identificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {learningInsights.patterns.slice(0, 5).map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} onArchive={archiveMemory} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {learningInsights.insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Insights do Axiom
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-2">
                {learningInsights.insights.slice(0, 5).map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} onArchive={archiveMemory} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* All Recent Memories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Memórias Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {allMemories.length > 0 ? (
                allMemories.slice(0, 15).map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} onArchive={archiveMemory} />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma memória ainda</p>
                  <p className="text-sm mt-1">Converse com Axiom para criar memórias automaticamente!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
