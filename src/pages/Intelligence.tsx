import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, TrendingUp, Target, Wallet, Brain, CheckSquare } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

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

const COLORS = ['#14B8A6', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6'];

export default function Intelligence() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadSummary();
  }, [user]);

  const loadSummary = async () => {
    setLoading(true);
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    try {
      // Tasks da semana
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('user_id', user?.id);

      const tasksCompleted = tasks?.filter(t => t.status === 'done').length || 0;
      const tasksTotal = tasks?.length || 0;

      // Habit logs da semana
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

      // Finanças do mês
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', user?.id)
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);

      const income = transactions?.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0) || 0;
      const expenses = transactions?.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0) || 0;

      // Notas da semana
      const { data: notes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', user?.id)
        .gte('created_at', weekStart);

      // Journal entries da semana
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
        setAiInsight(response.data.insights);
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
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Motor de Inteligência
          </h1>
          <p className="text-muted-foreground">Análise e insights personalizados</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-xs">Tarefas</span>
                  </div>
                  <p className="text-2xl font-bold">{summary?.tasksCompleted}/{summary?.tasksTotal}</p>
                  <p className="text-xs text-muted-foreground">{taskCompletion}% concluídas</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-xs">Hábitos</span>
                  </div>
                  <p className="text-2xl font-bold">{summary?.habitsCompleted}/{summary?.habitsTotal}</p>
                  <p className="text-xs text-muted-foreground">ativos esta semana</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs">Saldo</span>
                  </div>
                  <p className={`text-2xl font-bold ${(summary?.income || 0) - (summary?.expenses || 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                    R${((summary?.income || 0) - (summary?.expenses || 0)).toFixed(0)}
                  </p>
                  <p className="text-xs text-muted-foreground">este mês</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Brain className="h-4 w-4" />
                    <span className="text-xs">Reflexões</span>
                  </div>
                  <p className="text-2xl font-bold">{(summary?.notesCreated || 0) + (summary?.journalEntries || 0)}</p>
                  <p className="text-xs text-muted-foreground">esta semana</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Finanças do Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.some(d => d.value > 0) ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `R$${value.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sem dados financeiros</p>
                  )}
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[0] }} />
                      <span className="text-sm">Receitas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[1] }} />
                      <span className="text-sm">Despesas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Semanal</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* AI Insight */}
            <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Análise do Axiom
                  </CardTitle>
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
                        Gerar Análise
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {aiInsight ? (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiInsight}</p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Clique em "Gerar Análise" para receber insights personalizados sobre sua semana
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
