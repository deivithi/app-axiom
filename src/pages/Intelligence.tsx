import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, TrendingUp, Target, Wallet, Brain, CheckSquare, MessageSquare, BarChart3 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ScoreCard } from '@/components/intelligence/ScoreCard';
import { ScoreEvolutionChart } from '@/components/intelligence/ScoreEvolutionChart';
import { AppleCard, MetricCard, ChartCard } from '@/components/ui/apple-card';
import { formatCurrency } from '@/lib/utils';

interface WeeklySummary {
  tasksCompleted: number;
  tasksTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  income: number;
  expenses: number;
  notesCreated: number;
  journalEntries: number;
}

interface ScoreBreakdown {
  total_score: number;
  execution: { score: number; rate: number };
  financial: { score: number; rate: number };
  habits: { score: number; rate: number };
  projects: { score: number; rate: number };
  clarity: { score: number; rate: number };
}

interface ScoreHistoryItem {
  calculated_at: string;
  total_score: number;
}

interface LastInsight {
  content: string;
  date: string;
}

interface UserAnalysis {
  content: string;
  date: string;
}

const COLORS = ['hsl(var(--success))', 'hsl(var(--destructive))'];

export default function Intelligence() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistoryItem[]>([]);
  const [loadingScore, setLoadingScore] = useState(true);
  const [lastInsight, setLastInsight] = useState<LastInsight | null>(null);
  const [userAnalysis, setUserAnalysis] = useState<UserAnalysis | null>(null);
  const [generatingFirstReport, setGeneratingFirstReport] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const getNextMondayDate = () => {
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(7, 0, 0, 0);
    return nextMonday.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit'
    }) + ' às 7h';
  };

  const generateFirstWeeklyReport = async () => {
    setGeneratingFirstReport(true);
    try {
      const { error } = await supabase.functions.invoke('generate-weekly-report', {
        body: { trigger: 'manual', user_id: user?.id }
      });

      if (error) throw error;

      toast({
        title: "Relatório gerado! 📊",
        description: "Seu primeiro insight semanal está pronto.",
      });

      await loadLastInsight();
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível gerar o relatório.",
      });
    } finally {
      setGeneratingFirstReport(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSummary();
      loadScore();
      loadScoreHistory();
      loadLastInsight();
      loadUserAnalysis();
    }
  }, [user]);

  const loadLastInsight = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('user_id', user?.id)
        .eq('is_ai', true)
        .or('content.ilike.%📊 Relatório da Semana%,content.ilike.%📊 Relatório Completo%')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        // Remove markdown formatting from content
        const cleanContent = data.content
          .replace(/\*\*/g, '')
          .replace(/---/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        setLastInsight({
          content: cleanContent,
          date: new Date(data.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }
    } catch (error) {
      // No insights yet
    }
  };

  const loadUserAnalysis = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('user_id', user?.id)
        .eq('is_ai', true)
        .ilike('content', '%🧠 Análise Pessoal%')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        // Remove the marker and clean up the content
        const cleanContent = data.content
          .replace('🧠 Análise Pessoal\n\n', '')
          .replace(/\*\*/g, '')
          .replace(/---/g, '')
          .trim();
        
        setUserAnalysis({
          content: cleanContent,
          date: new Date(data.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
        setAiInsight(cleanContent);
      }
    } catch (error) {
      // No analysis yet
    }
  };

  const loadScore = async () => {
    setLoadingScore(true);
    try {
      const response = await supabase.functions.invoke('calculate-score', {
        body: { userId: user?.id, saveHistory: true }
      });
      
      if (response.data) {
        setScoreBreakdown(response.data);
      }
    } catch (error) {
      console.error('Error loading score:', error);
    }
    setLoadingScore(false);
  };

  const loadScoreHistory = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data } = await supabase
        .from('axiom_score_history')
        .select('calculated_at, total_score')
        .eq('user_id', user?.id)
        .gte('calculated_at', thirtyDaysAgo.toISOString())
        .order('calculated_at', { ascending: false })
        .limit(30);
      
      setScoreHistory(data || []);
    } catch (error) {
      console.error('Error loading score history:', error);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', user?.id);

      const tasksCompleted = tasks?.filter(t => t.status === 'done').length || 0;
      const tasksTotal = tasks?.length || 0;

      const { data: habits } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', user?.id);

      const { data: habitLogs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd);

      const habitsCompleted = new Set(habitLogs?.map(l => l.habit_id)).size;
      const habitsTotal = habits?.length || 0;

      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user?.id)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);

      const income = transactions?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
      const expenses = transactions?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;

      const { data: notes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', user?.id)
        .gte('created_at', weekStart);

      const { data: journal } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', user?.id)
        .gte('entry_date', weekStart)
        .lte('entry_date', weekEnd);

      setSummary({
        tasksCompleted,
        tasksTotal,
        habitsCompleted,
        habitsTotal,
        income,
        expenses,
        notesCreated: notes?.length || 0,
        journalEntries: journal?.length || 0,
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    }
    setLoading(false);
  };

  const generateWeeklyInsight = async () => {
    if (!summary) return;
    setGeneratingInsight(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_context, full_name')
        .eq('id', user?.id)
        .single();

      const summaryText = `
        Resumo da semana:
        - Tarefas: ${summary.tasksCompleted}/${summary.tasksTotal} concluídas
        - Hábitos ativos: ${summary.habitsCompleted}/${summary.habitsTotal}
        - Receitas: R$${summary.income.toFixed(2)}
        - Despesas: R$${summary.expenses.toFixed(2)}
        - Saldo: R$${(summary.income - summary.expenses).toFixed(2)}
        - Notas criadas: ${summary.notesCreated}
        - Entradas no diário: ${summary.journalEntries}
        ${scoreBreakdown ? `
        - Axiom Score: ${scoreBreakdown.total_score}/1000
        - Execução: ${scoreBreakdown.execution.score}/200
        - Financeiro: ${scoreBreakdown.financial.score}/200
        - Hábitos: ${scoreBreakdown.habits.score}/200
        - Projetos: ${scoreBreakdown.projects.score}/200
        - Clareza: ${scoreBreakdown.clarity.score}/200
        ` : ''}
      `;

      const response = await supabase.functions.invoke('analyze-content', {
        body: {
          content: summaryText,
          type: 'weekly_analysis',
          userContext: profile?.user_context,
          userName: profile?.full_name,
        }
      });

      if (response.data?.insights) {
        const insights = response.data.insights;
        setAiInsight(insights);
        
        // Persist the analysis in the database
        await supabase.from('messages').insert({
          user_id: user?.id,
          content: `🧠 Análise Pessoal\n\n${insights}`,
          is_ai: true
        });

        // Update local state with the new analysis
        setUserAnalysis({
          content: insights,
          date: new Date().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
        
        toast({ title: '✨ Análise gerada!', description: 'Axiom analisou sua semana' });
      }
    } catch (error) {
      console.error('Error generating insight:', error);
      toast({ title: 'Erro', description: 'Erro ao gerar análise', variant: 'destructive' });
    }
    setGeneratingInsight(false);
  };

  const taskCompletion = summary ? Math.round((summary.tasksCompleted / Math.max(summary.tasksTotal, 1)) * 100) : 0;

  const pieData = summary ? [
    { name: 'Receitas', value: summary.income },
    { name: 'Despesas', value: summary.expenses },
  ] : [];

  const performanceData = summary ? [
    { name: 'Tarefas', value: taskCompletion },
    { name: 'Hábitos', value: Math.round((summary.habitsCompleted / Math.max(summary.habitsTotal, 1)) * 100) },
  ] : [];

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-8">
        <div className="dashboard-header-apple">
          <h1>
            <Sparkles />
            Motor de Inteligência
          </h1>
          <p>Análise e insights personalizados para seu crescimento</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoreCard breakdown={scoreBreakdown} loading={loadingScore} />
              <ScoreEvolutionChart history={scoreHistory} loading={loadingScore} />
            </div>

            {/* Stats Grid */}
            <div className="stats-grid-apple">
              <MetricCard
                label="Tarefas"
                value={`${summary?.tasksCompleted}/${summary?.tasksTotal}`}
                icon={<CheckSquare className="h-5 w-5 text-primary" />}
                color="info"
                interactive
                onClick={() => navigate('/execution')}
              />

              <MetricCard
                label="Hábitos"
                value={`${summary?.habitsCompleted}/${summary?.habitsTotal}`}
                icon={<Target className="h-5 w-5 text-amber-500" />}
                color="warning"
                interactive
                onClick={() => navigate('/habits')}
              />

              <MetricCard
                label="Saldo"
                value={formatCurrency((summary?.income || 0) - (summary?.expenses || 0))}
                icon={<Wallet className="h-5 w-5 text-emerald-500" />}
                color={(summary?.income || 0) - (summary?.expenses || 0) >= 0 ? "success" : "error"}
                interactive
                onClick={() => navigate('/finances')}
              />

              <MetricCard
                label="Reflexões"
                value={(summary?.notesCreated || 0) + (summary?.journalEntries || 0)}
                icon={<Brain className="h-5 w-5 text-purple-500" />}
                color="default"
                interactive
                onClick={() => navigate('/memory')}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ChartCard title="Finanças do Mês">
                {pieData.some(d => d.value > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <defs>
                        <linearGradient id="gradientIncome" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="hsl(160, 84%, 39%)" />
                          <stop offset="100%" stopColor="hsl(158, 64%, 32%)" />
                        </linearGradient>
                        <linearGradient id="gradientExpense" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="hsl(0, 72%, 50%)" />
                          <stop offset="100%" stopColor="hsl(0, 72%, 40%)" />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="url(#gradientIncome)" />
                        <Cell fill="url(#gradientExpense)" />
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Sem dados financeiros</p>
                )}
                <div className="flex justify-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-sm">Receitas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Despesas</span>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Performance Semanal">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={performanceData}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--secondary))" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      formatter={(value: number) => `${value}%`}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="value" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* AI Insight */}
            <AppleCard elevation={2} glow className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Análise do Axiom</h3>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWeeklyInsight}
                  disabled={generatingInsight}
                >
                  {generatingInsight ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Gerar Nova Análise
                    </>
                  )}
                </Button>
              </div>
              {aiInsight ? (
                <div className="space-y-2">
                  {userAnalysis?.date && (
                    <p className="text-xs text-muted-foreground">{userAnalysis.date}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{aiInsight}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Clique em "Gerar Nova Análise" para receber insights personalizados sobre sua semana
                </p>
              )}
            </AppleCard>

            {/* Last Weekly Insight */}
            <AppleCard elevation={1} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Último Insight Semanal</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  ⚡ Gerado automaticamente
                </span>
              </div>
              {lastInsight ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>📅 Gerado em: {lastInsight.date}</span>
                    <span>🔄 Próximo: {getNextMondayDate()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{lastInsight.content}</p>
                </div>
              ) : (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nenhum insight semanal gerado ainda.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    📅 O Axiom gera automaticamente toda <strong>segunda-feira às 7h</strong>.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateFirstWeeklyReport}
                    disabled={generatingFirstReport}
                  >
                    {generatingFirstReport ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Gerar Primeiro Relatório
                      </>
                    )}
                  </Button>
                </div>
              )}
            </AppleCard>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
