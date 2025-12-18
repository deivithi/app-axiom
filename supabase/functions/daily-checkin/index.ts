import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Daily Check-in] Starting daily check-in generation...');

    // Get all active users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, personality_mode, user_context')
      .not('id', 'is', null);

    if (profilesError) {
      console.error('[Daily Check-in] Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`[Daily Check-in] Processing ${profiles?.length || 0} users`);

    const results = {
      processed: 0,
      questionsCreated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const profile of profiles || []) {
      try {
        // Check if user already has a pending question today
        const today = getBrazilDateStr();
        const { data: existingQuestion } = await supabase
          .from('proactive_questions')
          .select('id')
          .eq('user_id', profile.id)
          .eq('status', 'pending')
          .gte('created_at', `${today}T00:00:00Z`)
          .lt('created_at', `${today}T23:59:59Z`)
          .limit(1);

        if (existingQuestion && existingQuestion.length > 0) {
          console.log(`[Daily Check-in] User ${profile.id} already has question today, skipping`);
          results.skipped++;
          continue;
        }

        // Fetch user metrics for context
        const [tasksResult, habitsResult, transactionsResult] = await Promise.all([
          supabase
            .from('tasks')
            .select('id, status, priority')
            .eq('user_id', profile.id)
            .eq('status', 'pending'),
          supabase
            .from('habit_logs')
            .select('id')
            .eq('user_id', profile.id)
            .gte('completed_at', getBrazilDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
          supabase
            .from('transactions')
            .select('type, amount')
            .eq('user_id', profile.id)
            .gte('transaction_date', getBrazilDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        ]);

        const pendingTasks = tasksResult.data?.length || 0;
        const criticalTasks = tasksResult.data?.filter(t => t.priority === 'high').length || 0;
        const habitCompletions = habitsResult.data?.length || 0;
        
        const income = transactionsResult.data
          ?.filter(t => t.type === 'income')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const expenses = transactionsResult.data
          ?.filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        // Generate contextual daily question
        const dayOfWeek = getBrazilNow().getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        let question: string;
        let triggerType: string;
        let priority: string;

        // Prioritize based on user state
        if (criticalTasks >= 3) {
          question = `Você tem ${criticalTasks} tarefas críticas pendentes. Qual é a ÚNICA que, se concluída hoje, desbloquearia as outras?`;
          triggerType = 'task_overload';
          priority = 'critical';
        } else if (expenses > income * 1.2 && income > 0) {
          question = `Seus gastos estão ${Math.round((expenses/income - 1) * 100)}% acima da sua receita este mês. O que você pode cortar sem sentir falta?`;
          triggerType = 'spending_alert';
          priority = 'important';
        } else if (habitCompletions < 3 && !isWeekend) {
          question = `Apenas ${habitCompletions} hábitos completados esta semana. O que está atrapalhando sua rotina?`;
          triggerType = 'habit_low';
          priority = 'important';
        } else if (isWeekend) {
          question = `Final de semana! O que você faria hoje se não tivesse nenhuma obrigação pendente?`;
          triggerType = 'weekend_reflection';
          priority = 'normal';
        } else if (pendingTasks === 0) {
          question = `Sem tarefas pendentes! É hora de pensar no próximo nível. Qual projeto você está adiando?`;
          triggerType = 'growth_opportunity';
          priority = 'normal';
        } else {
          // Default daily check-in
          const dailyQuestions = [
            'Qual é a coisa mais importante que você precisa fazer hoje?',
            'Se você pudesse mudar uma coisa na sua rotina, o que seria?',
            'O que está consumindo sua energia sem dar retorno?',
            'Qual decisão você está adiando que poderia simplificar sua vida?',
            'O que te deu energia ontem? Como repetir isso hoje?',
          ];
          question = dailyQuestions[Math.floor(Math.random() * dailyQuestions.length)];
          triggerType = 'daily_checkin';
          priority = 'normal';
        }

        // Insert the question
        const { error: insertError } = await supabase
          .from('proactive_questions')
          .insert({
            user_id: profile.id,
            question,
            trigger_type: triggerType,
            priority,
            status: 'pending',
            context: JSON.stringify({
              pendingTasks,
              criticalTasks,
              habitCompletions,
              income,
              expenses,
              generatedAt: new Date().toISOString(),
            }),
          });

        if (insertError) {
          console.error(`[Daily Check-in] Error creating question for user ${profile.id}:`, insertError);
          results.errors++;
        } else {
          console.log(`[Daily Check-in] Created question for user ${profile.id}: "${question.substring(0, 50)}..."`);
          results.questionsCreated++;
        }

        results.processed++;
      } catch (userError) {
        console.error(`[Daily Check-in] Error processing user ${profile.id}:`, userError);
        results.errors++;
      }
    }

    console.log('[Daily Check-in] Completed:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Daily Check-in] Fatal error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
