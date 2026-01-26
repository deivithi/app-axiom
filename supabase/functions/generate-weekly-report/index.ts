import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== INPUT VALIDATION =====
const WeeklyReportRequestSchema = z.object({
  trigger: z.string().max(50).optional(),
  user_id: z.string().uuid('Invalid user_id format').optional()
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

// Formatação de moeda brasileira (manual para garantir formato correto no Deno)
const formatCurrency = (value: number): string => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Formata com 2 casas decimais
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Adiciona separador de milhar (ponto)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Monta o valor final com vírgula como separador decimal
  const formattedValue = `${formattedInteger},${decimalPart}`;
  
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
};

interface WeeklyReportPayload {
  week_start: string;
  week_end: string;
  score: {
    current: number;
    previous: number;
    change: number;
  };
  metrics: {
    tasks: { completed: number; total: number; rate: number };
    habits: { completed: number; total: number; rate: number };
    finances: { income: number; expenses: number; balance: number };
    projects: { active: number; updated: number };
  };
  patterns: Array<{
    type: string;
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
  highlights: string[];
  recommendations: string[];
  question_of_week: string;
  ai_analysis: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate input
    const body = await req.json();
    const parseResult = WeeklyReportRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid input",
        details: parseResult.error.errors.map(e => e.message)
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { trigger, user_id: specificUserId } = parseResult.data;

    console.log(`Weekly report generation triggered: ${trigger || 'manual'}`);

    // If specific user, generate for that user only
    // Otherwise, generate for all active users
    let userIds: string[] = [];

    if (specificUserId) {
      userIds = [specificUserId];
    } else {
      // Get active users (logged in within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: activeProfiles } = await supabase
        .from('profiles')
        .select('id')
        .gte('updated_at', thirtyDaysAgo.toISOString());
      
      userIds = activeProfiles?.map(p => p.id) || [];
    }

    console.log(`Generating reports for ${userIds.length} users`);

    const results = [];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = now.toISOString().split('T')[0];

    for (const userId of userIds) {
      try {
        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, user_context')
          .eq('id', userId)
          .single();

        const userName = profile?.full_name || 'usuário';

        // Fetch data in parallel
        const [
          tasksResult,
          habitsResult,
          habitLogsResult,
          projectsResult,
          transactionsResult,
          notesResult,
          journalResult,
          scoreHistoryResult
        ] = await Promise.all([
          supabase.from('tasks').select('*').eq('user_id', userId),
          supabase.from('habits').select('*').eq('user_id', userId),
          supabase.from('habit_logs').select('*').eq('user_id', userId).gte('completed_at', weekStartStr).lte('completed_at', weekEndStr),
          supabase.from('projects').select('*').eq('user_id', userId).eq('status', 'active'),
          supabase.from('transactions').select('*').eq('user_id', userId).gte('transaction_date', weekStartStr).lte('transaction_date', weekEndStr),
          supabase.from('notes').select('id').eq('user_id', userId).gte('created_at', weekStart.toISOString()).lte('created_at', now.toISOString()),
          supabase.from('journal_entries').select('id').eq('user_id', userId).gte('entry_date', weekStartStr).lte('entry_date', weekEndStr),
          supabase.from('axiom_score_history').select('total_score, calculated_at')
            .eq('user_id', userId)
            .order('calculated_at', { ascending: false })
            .limit(14)
        ]);

        const tasks = tasksResult.data || [];
        const habits = habitsResult.data || [];
        const habitLogs = habitLogsResult.data || [];
        const projects = projectsResult.data || [];
        const transactions = transactionsResult.data || [];
        const notes = notesResult.data || [];
        const journal = journalResult.data || [];
        const scoreHistory = scoreHistoryResult.data || [];

        // Calculate metrics
        const completedTasks = tasks.filter(t => t.status === 'done').length;
        const totalTasks = tasks.length;
        const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        const uniqueHabitsCompleted = new Set(habitLogs.map(l => l.habit_id)).size;
        const totalHabits = habits.length;
        const habitRate = totalHabits > 0 ? Math.round((uniqueHabitsCompleted / totalHabits) * 100) : 0;

        const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);

        const projectsUpdatedThisWeek = projects.filter(p => {
          const updatedAt = new Date(p.updated_at);
          return updatedAt >= weekStart;
        }).length;

        // Calculate score change
        const currentScore = scoreHistory[0]?.total_score || 0;
        const previousScore = scoreHistory[7]?.total_score || scoreHistory[scoreHistory.length - 1]?.total_score || currentScore;
        const scoreChange = currentScore - previousScore;

        // Detect patterns
        const patterns: WeeklyReportPayload['patterns'] = [];

        // Inactive projects
        const inactiveProjects = projects.filter(p => {
          const daysSince = (now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 7;
        });
        
        if (inactiveProjects.length > 0) {
          patterns.push({
            type: 'project_inactive',
            title: 'Projetos Inativos',
            description: `${inactiveProjects.length} projeto(s) sem atualização há mais de 7 dias`,
            severity: 'warning'
          });
        }

        // Spending anomalies
        const expensesByCategory: Record<string, number> = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
          expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount);
        });

        const highSpendCategories = Object.entries(expensesByCategory)
          .filter(([_, amount]) => amount > 200)
          .sort((a, b) => b[1] - a[1]);

        if (highSpendCategories.length > 0) {
          const [category, amount] = highSpendCategories[0];
          patterns.push({
            type: 'spending_high',
            title: `Alto gasto em ${category}`,
            description: `${formatCurrency(amount)} esta semana`,
            severity: amount > 500 ? 'critical' : 'warning'
          });
        }

        // Low task completion
        if (taskRate < 50 && totalTasks > 3) {
          patterns.push({
            type: 'low_productivity',
            title: 'Tarefas Atrasadas',
            description: `Apenas ${taskRate}% das tarefas concluídas`,
            severity: taskRate < 30 ? 'critical' : 'warning'
          });
        }

        // Habit streaks broken
        const brokenStreaks = habits.filter(h => h.current_streak === 0 && h.best_streak > 3);
        if (brokenStreaks.length > 0) {
          patterns.push({
            type: 'habit_broken',
            title: 'Streaks Quebrados',
            description: `${brokenStreaks.length} hábito(s) perderam seus streaks`,
            severity: 'warning'
          });
        }

        // Generate highlights
        const highlights: string[] = [];
        if (completedTasks > 0) highlights.push(`✅ ${completedTasks} tarefas concluídas`);
        if (habitLogs.length > 0) highlights.push(`🎯 ${habitLogs.length} dias de hábitos completados`);
        if (income > 0) highlights.push(`💰 ${formatCurrency(income)} em receitas`);
        if (notes.length > 0 || journal.length > 0) {
          highlights.push(`📝 ${notes.length + journal.length} reflexões registradas`);
        }

        // Generate recommendations
        const recommendations: string[] = [];
        if (inactiveProjects.length > 0) {
          recommendations.push(`Foque em \"${inactiveProjects[0].title}\" - está parado há muito tempo`);
        }
        if (taskRate < 50) {
          recommendations.push('Revise suas tarefas e priorize as 3 mais importantes');
        }
        if (expenses > income && income > 0) {
          recommendations.push(`Reduza gastos - você está no vermelho ${formatCurrency(expenses - income)}`);
        }
        if (brokenStreaks.length > 0) {
          recommendations.push(`Retome o hábito \"${brokenStreaks[0].title}\" hoje`);
        }

        // Generate AI analysis
        const analysisPrompt = `Você é Axiom, estrategista pessoal de ${userName}. Analise a semana:

Score: ${currentScore} (${scoreChange >= 0 ? '+' : ''}${scoreChange})
Tarefas: ${completedTasks}/${totalTasks} (${taskRate}%)
Hábitos: ${uniqueHabitsCompleted}/${totalHabits} ativos
Finanças: ${formatCurrency(income)} receitas, ${formatCurrency(expenses)} gastos
Projetos: ${projects.length} ativos, ${projectsUpdatedThisWeek} atualizados
${profile?.user_context ? `Contexto: ${profile.user_context}` : ''}

Padrões detectados: ${patterns.map(p => p.title).join(', ') || 'Nenhum crítico'}

REGRAS CRÍTICAS:
1. NÃO USE MARKDOWN - escreva texto normal sem ** ou --- ou qualquer formatação especial
2. Use emojis naturalmente para dar vida ao texto 🎯💡🔥📈
3. Máximo 3 parágrafos curtos
4. Destaque o ponto mais importante da semana
5. Identifique um padrão comportamental
6. Termine com uma pergunta provocativa
7. Tom: mentor amigo, direto, sem formalidade corporativa`;

        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-5.2',
            messages: [{ role: 'user', content: analysisPrompt }],
            max_tokens: 500,
            temperature: 0.7
          })
        });

        const aiData = await aiResponse.json();
        const aiAnalysis = aiData.choices?.[0]?.message?.content?.trim() || 
          'Semana registrada. Revise seus dados no dashboard.';

        // Extract question from analysis or generate one
        const questionMatch = aiAnalysis.match(/\?[^?]*$/);
        const questionOfWeek = questionMatch ? questionMatch[0] : 
          `${userName}, o que você priorizou esta semana que não deveria?`;

        // Build payload
        const payload: WeeklyReportPayload = {
          week_start: weekStartStr,
          week_end: weekEndStr,
          score: {
            current: currentScore,
            previous: previousScore,
            change: scoreChange
          },
          metrics: {
            tasks: { completed: completedTasks, total: totalTasks, rate: taskRate },
            habits: { completed: uniqueHabitsCompleted, total: totalHabits, rate: habitRate },
            finances: { income, expenses, balance: income - expenses },
            projects: { active: projects.length, updated: projectsUpdatedThisWeek }
          },
          patterns,
          highlights,
          recommendations,
          question_of_week: questionOfWeek,
          ai_analysis: aiAnalysis
        };

        // Format week dates
        const weekDateFormatted = `${new Date(weekStartStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${new Date(weekEndStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

        // Save as message in chat (simple summary)
        const welcomeContent = `📊 Axiom Insights - Semana ${weekDateFormatted}

Bom dia, ${userName}! Seu relatório semanal está pronto.

Score: ${currentScore} ${scoreChange >= 0 ? '📈' : '📉'} (${scoreChange >= 0 ? '+' : ''}${scoreChange})`;

        const { data: savedMessage, error: saveError } = await supabase
          .from('messages')
          .insert({
            user_id: userId,
            content: welcomeContent,
            is_ai: true,
            message_type: 'weekly_report'
          })
          .select()
          .single();

        if (saveError) {
          console.error(`Error saving report for user ${userId}:`, saveError);
          continue;
        }

        // Build the full report content - compact format with proper currency
        const balance = income - expenses;
        const habitsWithStreak = habits.filter(h => h.current_streak > 0).length;
        
        const fullReportContent = `📊 Relatório da Semana ${weekDateFormatted}

${aiAnalysis}

📈 Métricas: ${completedTasks}/${totalTasks} tarefas (${taskRate}%) • ${habitsWithStreak}/${totalHabits} hábitos ativos

💰 Financeiro: Receitas ${formatCurrency(income)} | Despesas ${formatCurrency(expenses)} | Saldo ${formatCurrency(balance)}
${patterns.length > 0 ? `
⚠️ Atenção: ${patterns.map(p => `${p.title}`).join(' • ')}` : ''}${recommendations.length > 0 ? `

💡 Dicas: ${recommendations.join(' • ')}` : ''}

❓ ${questionOfWeek}`;

        // Save the full report as a follow-up message (not in chat)
        await supabase
          .from('messages')
          .insert({
            user_id: userId,
            content: fullReportContent,
            is_ai: true,
            message_type: 'weekly_report'
          });

        results.push({ userId, success: true, messageId: savedMessage?.id });
        console.log(`Report generated for user ${userId}`);

      } catch (userError) {
        console.error(`Error generating report for user ${userId}:`, userError);
        results.push({ userId, success: false, error: String(userError) });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      generated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-weekly-report:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

