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
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

  // Coleta dados reais do Supabase para relatórios
  const collectReportData = async () => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const nextWeekStart = format(new Date(startOfWeek(now, { weekStartsOn: 1 }).getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const nextMonthStart = format(new Date(now.getFullYear(), now.getMonth() + 1, 1), 'yyyy-MM-dd');

    const [profileRes, transactionsRes, habitsRes, tasksRes, projectsRes, memoriesRes, scoreRes] = await Promise.all([
      supabase.from('profiles').select('full_name, user_context, personality_mode').eq('id', user?.id).single(),
      supabase.from('transactions').select('title, amount, type, category, transaction_date, is_paid').eq('user_id', user?.id).gte('transaction_date', monthStart).lt('transaction_date', nextMonthStart).order('transaction_date', { ascending: false }).limit(50),
      supabase.from('habits').select('title, current_streak, best_streak, frequency').eq('user_id', user?.id),
      supabase.from('tasks').select('title, priority, status, due_date').eq('user_id', user?.id),
      supabase.from('projects').select('title, status, progress, due_date').eq('user_id', user?.id),
      supabase.from('memories').select('type, content').eq('user_id', user?.id).is('archived_at', null).limit(20),
      supabase.from('axiom_score_history').select('total_score, financial_score, habits_score, execution_score, clarity_score, projects_score').eq('user_id', user?.id).order('calculated_at', { ascending: false }).limit(1),
    ]);

    const transactions = transactionsRes.data || [];
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);
    const tasks = tasksRes.data || [];
    const habits = habitsRes.data || [];
    const projects = projectsRes.data || [];

    return {
      profile: profileRes.data,
      monthLabel: now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      weekLabel: `${format(startOfWeek(now, { weekStartsOn: 1 }), 'dd/MM')} a ${format(endOfWeek(now, { weekStartsOn: 1 }), 'dd/MM')}`,
      finance: {
        income: formatCurrency(income),
        expenses: formatCurrency(expenses),
        balance: formatCurrency(income - expenses),
        balanceValue: income - expenses,
        categories: Object.entries(
          transactions.filter(t => t.type === 'expense').reduce((acc: Record<string, number>, t) => {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, val]) => `${cat}: ${formatCurrency(val)}`),
        topExpenses: transactions.filter(t => t.type === 'expense').slice(0, 5).map(t => `${t.title}: ${formatCurrency(Math.abs(t.amount))}`),
      },
      habits: {
        total: habits.length,
        active: habits.filter(h => h.current_streak > 0).length,
        list: habits.map(h => `${h.title} (streak: ${h.current_streak} dias, recorde: ${h.best_streak})`),
      },
      tasks: {
        total: tasks.length,
        done: tasks.filter(t => t.status === 'done').length,
        pending: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length,
      },
      projects: {
        total: projects.length,
        active: projects.filter(p => p.status !== 'completed').length,
        list: projects.filter(p => p.status !== 'completed').map(p => `${p.title}: ${p.progress}%`),
      },
      memories: (memoriesRes.data || []).map(m => `[${m.type}] ${m.content}`),
      score: scoreRes.data?.[0] || null,
    };
  };

  // Gerar relatório via /api/chat com prompt especializado
  const callAIForReport = async (prompt: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          context: null,
          stream: false // Modo não-streaming para relatórios (evita cortar caracteres)
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      return data.content || null;
    } catch (error) {
      console.error('Error calling AI:', error);
      return null;
    }
  };

  const generateFirstWeeklyReport = async () => {
    setGeneratingFirstReport(true);
    try {
      const data = await collectReportData();

      const prompt = `Você é o Axiom. Gere um RELATÓRIO SEMANAL conciso para ${data.profile?.full_name || 'o usuário'}.

Semana: ${data.weekLabel} | Mês: ${data.monthLabel}

DADOS (use EXATAMENTE estes valores, já formatados):
Receitas: ${data.finance.income} | Despesas: ${data.finance.expenses} | Saldo: ${data.finance.balance}
Top gastos: ${data.finance.categories.join(', ')}
Maiores despesas: ${data.finance.topExpenses.join(', ')}
Hábitos: ${data.habits.total} total, ${data.habits.active} ativos | ${data.habits.list.join(' | ') || 'Nenhum'}
Tarefas: ${data.tasks.done}/${data.tasks.total} feitas | ${data.tasks.overdue} atrasadas
Projetos: ${data.projects.list.join(', ') || 'Nenhum'}
${data.score ? `Score: ${data.score.total_score}/100` : ''}

REGRAS OBRIGATÓRIAS DE FORMATO:
- PROIBIDO usar markdown (nada de **, ##, ---, \`\`\`)
- Texto puro com emojis como separadores visuais
- Máximo 15 linhas no total
- Cada seção = 1 a 2 linhas no máximo
- Valores financeiros copiados EXATAMENTE como acima

ESTRUTURA EXATA (siga esta ordem):

📊 Relatório da Semana [semana]
[1 frase resumo: "Semana de [adjetivo], com saldo [positivo/negativo] de [valor]"]

💰 Finanças
Receitas: [valor] | Despesas: [valor] | Saldo: [valor]
Destaques: [2-3 maiores gastos com valores]

🎯 Hábitos
[Listar cada hábito com streak e status em 1 linha]

✅ Execução
Tarefas: [X/Y] | Projetos: [lista curta]

⚡ 3 Ações da Semana
1) [ação prática e específica]
2) [ação prática e específica]
3) [ação prática e específica]

Português do Brasil. Sem enrolação.`;


      const result = await callAIForReport(prompt);

      if (result) {
        await supabase.from('messages').insert({
          user_id: user?.id,
          content: `📊 Relatório da Semana ${data.weekLabel}\n\n${result}`,
          is_ai: true,
          message_type: 'weekly_report'
        });

        setLastInsight({
          content: result,
          date: new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        });

        toast({ title: 'Relatório gerado! 📊', description: 'Seu insight semanal está pronto.' });
      } else {
        throw new Error('Resposta vazia da IA');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível gerar o relatório.' });
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
        .gte('created_at', weekStart)
        .lte('created_at', weekEnd);

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
    setGeneratingInsight(true);

    try {
      const data = await collectReportData();

      const personalityInstruction = data.profile?.personality_mode === 'sabio'
        ? 'Tom reflexivo e filosófico. Faça perguntas que provoquem reflexão profunda.'
        : data.profile?.personality_mode === 'parceiro'
          ? 'Tom caloroso e empático. Celebre conquistas e ofereça apoio genuíno.'
          : 'Tom direto e honesto. Sem rodeios, diga a verdade com respeito.';

      const prompt = `Você é o Axiom, coach de vida pessoal de ${data.profile?.full_name || 'o usuário'}.

${data.profile?.user_context ? `CONTEXTO PESSOAL (definido pelo próprio usuário):\n${data.profile.user_context}\n` : ''}
${data.memories.length > 0 ? `MEMÓRIAS SALVAS:\n${data.memories.join('\n')}\n` : ''}

DADOS DO MÊS (${data.monthLabel}):
Receitas: ${data.finance.income} | Despesas: ${data.finance.expenses} | Saldo: ${data.finance.balance}
Maiores gastos: ${data.finance.topExpenses.join(', ')}
Hábitos: ${data.habits.total} total, ${data.habits.active} ativos
Tarefas: ${data.tasks.done}/${data.tasks.total} | Score: ${data.score?.total_score || 'N/A'}/100

SUA MISSÃO: Gere uma ANÁLISE PESSOAL ESTRATÉGICA (diferente de relatório numérico).
Foque em PADRÕES DE COMPORTAMENTO, não em listar números.

${personalityInstruction}

REGRAS DE FORMATO:
- PROIBIDO markdown (nada de **, ##, ---, crases)
- Texto puro com emojis
- Máximo 12 linhas
- Frases curtas e impactantes (máximo 2 frases por seção)
- Use o NOME da pessoa
- Referencie memórias e contexto pessoal quando relevante

ESTRUTURA (siga EXATAMENTE):

🔥 [Nome], [1 frase-diagnóstico sobre o momento atual dela baseado nos dados]

💰 [Insight financeiro: não repita números, INTERPRETE o padrão. Ex: "Seu gasto com telefonia está fora da curva"]

🎯 [Insight sobre hábitos: consistência, o que falta, o que melhorou]

⚡ O que fazer agora:
1) [Ação específica e prática]
2) [Ação específica e prática]
3) [Ação específica e prática]

❓ [1 pergunta poderosa e pessoal para provocar reflexão]

Português do Brasil. Seja BREVE e IMPACTANTE.`;


      const result = await callAIForReport(prompt);

      if (result) {
        setAiInsight(result);

        await supabase.from('messages').insert({
          user_id: user?.id,
          content: `🧠 Análise Pessoal\n\n${result} `,
          is_ai: true,
          message_type: 'personal_analysis'
        });

        setUserAnalysis({
          content: result,
          date: new Date().toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        });

        toast({ title: '✨ Análise gerada!', description: 'Axiom analisou seus dados completos' });
      } else {
        throw new Error('Resposta vazia da IA');
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
          <PageSkeleton cards={2} />
        ) : (
          <div className="space-y-6">
            {/* Score Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoreCard breakdown={scoreBreakdown} loading={loadingScore} />
              <ScoreEvolutionChart history={scoreHistory} loading={loadingScore} />
            </div>

            {/* Stats Grid */}
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, staggerChildren: 0.1 }}
            >
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <MetricCard
                  label="Tarefas"
                  value={`${summary?.tasksCompleted}/${summary?.tasksTotal}`}
                  icon={< CheckSquare className="h-5 w-5 text-primary" />}
                  color="info"
                  interactive
                  onClick={() => navigate('/execution')}
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
                < MetricCard
                  label="Hábitos"
                  value={`${summary?.habitsCompleted}/${summary?.habitsTotal}`}
                  icon={< Target className="h-5 w-5 text-amber-500" />}
                  color="warning"
                  interactive
                  onClick={() => navigate('/habits')}
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                < MetricCard
                  label="Saldo"
                  value={formatCurrency((summary?.income || 0) - (summary?.expenses || 0))}
                  icon={< Wallet className="h-5 w-5 text-emerald-500" />}
                  color={(summary?.income || 0) - (summary?.expenses || 0) >= 0 ? "success" : "error"}
                  interactive
                  onClick={() => navigate('/finances')}
                />
              </motion.div>

              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
                < MetricCard
                  label="Reflexões"
                  value={(summary?.notesCreated || 0) + (summary?.journalEntries || 0)}
                  icon={< Brain className="h-5 w-5 text-purple-500" />}
                  color="default"
                  interactive
                  onClick={() => navigate('/memory')}
                />
              </motion.div>
            </motion.div>

            {/* Charts */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
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
            </motion.div>

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
              {
                aiInsight ? (
                  <div className="space-y-2">
                    {userAnalysis?.date && (
                      <p className="text-xs text-muted-foreground">{userAnalysis.date}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{aiInsight.replace(/\*\*/g, '').replace(/---/g, '').replace(/^#{1,3}\s/gm, '').replace(/\n{3,}/g, '\n\n').trim()}</p>
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
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    ⚡ Gerado automaticamente
                  </span>
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
                        Novo Insight
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {
                lastInsight ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>📅 Gerado em: {lastInsight.date}</span>
                      <span>🔄 Próximo: {getNextMondayDate()}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{lastInsight.content.replace(/\*\*/g, '').replace(/---/g, '').replace(/^#{1,3}\s/gm, '').replace(/\n{3,}/g, '\n\n').trim()}</p>
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
                )
              }
            </AppleCard>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
