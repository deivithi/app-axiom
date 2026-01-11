import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== INPUT VALIDATION =====
const AnalyzeRequestSchema = z.object({
  user_id: z.string().uuid('Invalid user_id format')
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

// ===== HELPERS PARA TIMEZONE DO BRASIL =====
function getBrazilDateStr(date?: Date): string {
  const d = date || new Date();
  const brazilDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBrazilNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

interface PatternAnalysis {
  trigger_type: string;
  priority: 'critical' | 'important' | 'normal' | 'reflective';
  question: string;
  context: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Validate input
    const body = await req.json();
    const parseResult = AnalyzeRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid input",
        details: parseResult.error.errors.map(e => e.message)
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const { user_id } = parseResult.data;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, user_context')
      .eq('id', user_id)
      .single();

    const userName = profile?.full_name || 'usuário';

    // Check if there's already a pending question for today
    const today = getBrazilDateStr();
    const { data: existingQuestion } = await supabase
      .from('proactive_questions')
      .select('id')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .gte('created_at', `${today}T00:00:00`)
      .single();

    if (existingQuestion) {
      return new Response(JSON.stringify({ 
        message: "Already has pending question for today",
        question_id: existingQuestion.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather data for analysis - usando timezone Brasil
    const now = getBrazilNow();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = getBrazilDateStr(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

    // Parallel data fetching
    const [
      tasksResult,
      habitsResult,
      habitLogsResult,
      projectsResult,
      transactionsResult,
      remindersResult,
      journalResult
    ] = await Promise.all([
      supabase.from('tasks').select('*').eq('user_id', user_id).gte('created_at', weekAgo),
      supabase.from('habits').select('*').eq('user_id', user_id),
      supabase.from('habit_logs').select('*').eq('user_id', user_id).gte('completed_at', weekAgo),
      supabase.from('projects').select('*').eq('user_id', user_id).eq('status', 'active'),
      supabase.from('transactions').select('*').eq('user_id', user_id).gte('transaction_date', monthAgo),
      supabase.from('reminders').select('*').eq('user_id', user_id).eq('is_completed', false),
      supabase.from('journal_entries').select('*').eq('user_id', user_id).gte('entry_date', weekAgo).order('entry_date', { ascending: false }).limit(5)
    ]);

    const tasks = tasksResult.data || [];
    const habits = habitsResult.data || [];
    const habitLogs = habitLogsResult.data || [];
    const projects = projectsResult.data || [];
    const transactions = transactionsResult.data || [];
    const reminders = remindersResult.data || [];
    const journalEntries = journalResult.data || [];

    // Calculate metrics
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Habit analysis
    const habitCompletionsThisWeek = habitLogs.length;
    const expectedHabitCompletions = habits.filter(h => h.frequency === 'daily').length * 7;
    const habitCompletionRate = expectedHabitCompletions > 0 ? (habitCompletionsThisWeek / expectedHabitCompletions) * 100 : 0;

    // Find broken streaks
    const brokenStreaks = habits.filter(h => h.current_streak === 0 && h.best_streak > 3);

    // Inactive projects (no updates in 7+ days)
    const inactiveProjects = projects.filter(p => {
      const updatedAt = new Date(p.updated_at);
      const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 7;
    });

    // Spending analysis
    const expenses = transactions.filter(t => t.type === 'expense');
    const expensesByCategory: Record<string, number[]> = {};
    expenses.forEach(e => {
      if (!expensesByCategory[e.category]) {
        expensesByCategory[e.category] = [];
      }
      expensesByCategory[e.category].push(e.amount);
    });

    // Find anomalous spending (>2x average)
    const anomalousSpending: { category: string; current: number; average: number }[] = [];
    Object.entries(expensesByCategory).forEach(([category, amounts]) => {
      if (amounts.length >= 3) {
        const thisWeekTotal = amounts.slice(0, Math.ceil(amounts.length / 4)).reduce((a, b) => a + b, 0);
        const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        if (thisWeekTotal > average * 2 && thisWeekTotal > 100) {
          anomalousSpending.push({ category, current: thisWeekTotal, average });
        }
      }
    });

    // Calculate overall score
    const baseScore = 50;
    const taskBonus = taskCompletionRate * 0.2;
    const habitBonus = habitCompletionRate * 0.2;
    const projectPenalty = inactiveProjects.length * 5;
    const overallScore = Math.min(100, Math.max(0, baseScore + taskBonus + habitBonus - projectPenalty));

    // Detect patterns and generate question
    const patterns: PatternAnalysis[] = [];

    // Pattern 1: Broken habit streak
    if (brokenStreaks.length > 0) {
      const habit = brokenStreaks[0];
      patterns.push({
        trigger_type: 'habit_broken',
        priority: 'important',
        question: `Você manteve "${habit.title}" por ${habit.best_streak} dias e quebrou o streak. 🤔 O que mudou? Foi algo externo ou você perdeu a motivação?`,
        context: JSON.stringify({ habit_title: habit.title, best_streak: habit.best_streak })
      });
    }

    // Pattern 2: Inactive projects
    if (inactiveProjects.length > 0) {
      const project = inactiveProjects[0];
      const daysSinceUpdate = Math.floor((now.getTime() - new Date(project.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      patterns.push({
        trigger_type: 'project_inactive',
        priority: 'important',
        question: `Projeto "${project.title}" está parado há ${daysSinceUpdate} dias. 🎯 Qual é o bloqueio real? É falta de tempo, clareza, ou interesse diminuiu?`,
        context: JSON.stringify({ project_title: project.title, days_inactive: daysSinceUpdate })
      });
    }

    // Pattern 3: Anomalous spending
    if (anomalousSpending.length > 0) {
      const spending = anomalousSpending[0];
      patterns.push({
        trigger_type: 'spending_anomaly',
        priority: 'critical',
        question: `R$${spending.current.toFixed(0)} em ${spending.category} esta semana (${(spending.current / spending.average).toFixed(1)}x sua média). 💰 Isso é compensação emocional ou gasto necessário?`,
        context: JSON.stringify(spending)
      });
    }

    // Pattern 4: Low task completion
    if (taskCompletionRate < 30 && totalTasks > 3) {
      patterns.push({
        trigger_type: 'score_drop',
        priority: 'important',
        question: `Apenas ${completedTasks} de ${totalTasks} tarefas concluídas esta semana (${taskCompletionRate.toFixed(0)}%). 📋 Você está sobrecarregado ou as prioridades mudaram?`,
        context: JSON.stringify({ completed: completedTasks, total: totalTasks, rate: taskCompletionRate })
      });
    }

    // Pattern 5: Low habit completion
    if (habitCompletionRate < 50 && habits.length > 0) {
      patterns.push({
        trigger_type: 'score_drop',
        priority: 'normal',
        question: `Seus hábitos estão em ${habitCompletionRate.toFixed(0)}% esta semana. 🎯 O que está competindo pela sua energia?`,
        context: JSON.stringify({ habit_rate: habitCompletionRate, habits_count: habits.length })
      });
    }

    // Pattern 6: Many pending reminders
    const overdueReminders = reminders.filter(r => new Date(r.remind_at) < now).length;
    if (overdueReminders > 3) {
      patterns.push({
        trigger_type: 'custom',
        priority: 'normal',
        question: `Você tem ${overdueReminders} lembretes vencidos. ⏰ Quer que eu te ajude a reorganizar ou descartar o que não faz mais sentido?`,
        context: JSON.stringify({ overdue_count: overdueReminders })
      });
    }

    // If no specific patterns, generate a daily reflective question
    if (patterns.length === 0) {
      // Use AI to generate contextual question based on user data
      const aiPrompt = `Você é Axiom, um estrategista pessoal. Com base nos dados do usuário ${userName}:
- Taxa de tarefas concluídas: ${taskCompletionRate.toFixed(0)}%
- Taxa de hábitos: ${habitCompletionRate.toFixed(0)}%
- Projetos ativos: ${projects.length}
- Score geral: ${overallScore.toFixed(0)}/100
${profile?.user_context ? `Contexto pessoal: ${profile.user_context}` : ''}

Gere UMA pergunta estratégica provocativa que faça o usuário refletir sobre sua semana. 
A pergunta deve ser direta, pessoal e estimular ação. Não seja genérico.
Responda APENAS com a pergunta, sem explicações.`;

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [{ role: 'user', content: aiPrompt }],
          max_tokens: 150,
          temperature: 0.8
        })
      });

      const aiData = await aiResponse.json();
      const generatedQuestion = aiData.choices?.[0]?.message?.content?.trim() || 
        `${userName}, o que você quer conquistar hoje que vai te fazer orgulhoso amanhã? 🚀`;

      patterns.push({
        trigger_type: 'daily',
        priority: 'reflective',
        question: generatedQuestion,
        context: JSON.stringify({ score: overallScore, task_rate: taskCompletionRate, habit_rate: habitCompletionRate })
      });
    }

    // Sort by priority and take the most important
    const priorityOrder = { critical: 0, important: 1, normal: 2, reflective: 3 };
    patterns.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    const selectedPattern = patterns[0];

    // Save the proactive question
    const { data: savedQuestion, error: saveError } = await supabase
      .from('proactive_questions')
      .insert({
        user_id,
        question: selectedPattern.question,
        context: selectedPattern.context,
        trigger_type: selectedPattern.trigger_type,
        priority: selectedPattern.priority,
        status: 'pending'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving proactive question:', saveError);
      throw saveError;
    }

    return new Response(JSON.stringify({ 
      success: true,
      question: savedQuestion,
      metrics: {
        task_completion_rate: taskCompletionRate,
        habit_completion_rate: habitCompletionRate,
        overall_score: overallScore,
        inactive_projects: inactiveProjects.length,
        broken_streaks: brokenStreaks.length
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-patterns:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
