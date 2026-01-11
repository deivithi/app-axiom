import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== INPUT VALIDATION =====
const InjectVariablesRequestSchema = z.object({
  promptTemplate: z.string().min(1).max(50000, 'Prompt template too long'),
  userId: z.string().uuid('Invalid userId format')
});

interface UserContext {
  usuario_nome: string;
  usuario_desde: string;
  axiom_score: string;
  score_variacao: string;
  saldo_total: string;
  gastos_mes: string;
  receitas_mes: string;
  tarefas_pendentes: string;
  tarefas_concluidas: string;
  projetos_ativos: string;
  habitos_completos: string;
  streak_max: string;
  data_hoje: string;
  hora_atual: string;
  dia_semana: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate input
    const body = await req.json();
    const parseResult = InjectVariablesRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid input",
          details: parseResult.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { promptTemplate, userId } = parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[inject-variables] Processing prompt for user ${userId}`);

    // Fetch all required data in parallel
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
    
    const currentMonth = now.toISOString().slice(0, 7);

    const [
      profileResult,
      scoreResult,
      accountsResult,
      transactionsResult,
      tasksResult,
      projectsResult,
      habitsResult,
      habitLogsResult
    ] = await Promise.all([
      // Profile
      supabase.from("profiles").select("full_name, created_at").eq("id", userId).single(),
      // Latest score
      supabase.from("axiom_score_history").select("total_score, calculated_at").eq("user_id", userId).order("calculated_at", { ascending: false }).limit(2),
      // Accounts
      supabase.from("accounts").select("balance").eq("user_id", userId),
      // Current month transactions
      supabase.from("transactions").select("amount, type").eq("user_id", userId).gte("transaction_date", `${currentMonth}-01`),
      // Tasks
      supabase.from("tasks").select("status").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr),
      // Active projects
      supabase.from("projects").select("id").eq("user_id", userId).eq("status", "active"),
      // Habits
      supabase.from("habits").select("id, current_streak, best_streak").eq("user_id", userId),
      // Habit logs for today
      supabase.from("habit_logs").select("habit_id").eq("user_id", userId).eq("completed_at", now.toISOString().split("T")[0])
    ]);

    // Calculate values
    const profile = profileResult.data;
    const scores = scoreResult.data || [];
    const accounts = accountsResult.data || [];
    const transactions = transactionsResult.data || [];
    const tasks = tasksResult.data || [];
    const projects = projectsResult.data || [];
    const habits = habitsResult.data || [];
    const habitLogs = habitLogsResult.data || [];

    // Score calculation
    const currentScore = scores[0]?.total_score || 0;
    const previousScore = scores[1]?.total_score || currentScore;
    const scoreVariation = currentScore - previousScore;

    // Financial calculations
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);
    const monthIncome = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const monthExpenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);

    // Tasks calculation
    const tasksPending = tasks.filter(t => t.status !== "done").length;
    const tasksCompleted = tasks.filter(t => t.status === "done").length;

    // Habits calculation
    const habitsTotal = habits.length;
    const habitsCompletedToday = habitLogs.length;
    const maxStreak = Math.max(...habits.map(h => h.best_streak || 0), 0);

    // Temporal
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const userSince = profile?.created_at 
      ? new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
      : "recente";

    const context: UserContext = {
      usuario_nome: profile?.full_name || "Usuário",
      usuario_desde: userSince,
      axiom_score: currentScore.toString(),
      score_variacao: scoreVariation >= 0 ? `+${scoreVariation}` : scoreVariation.toString(),
      saldo_total: `R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      gastos_mes: `R$ ${monthExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      receitas_mes: `R$ ${monthIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      tarefas_pendentes: tasksPending.toString(),
      tarefas_concluidas: tasksCompleted.toString(),
      projetos_ativos: projects.length.toString(),
      habitos_completos: `${habitsCompletedToday}/${habitsTotal}`,
      streak_max: maxStreak.toString(),
      data_hoje: now.toLocaleDateString("pt-BR"),
      hora_atual: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      dia_semana: dias[now.getDay()]
    };

    // Extract variables from template
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = [...promptTemplate.matchAll(variableRegex)];
    const variablesUsed = matches.map(m => m[1]);

    // Inject variables
    let processedPrompt = promptTemplate;
    Object.entries(context).forEach(([key, value]) => {
      const variable = `{{${key}}}`;
      processedPrompt = processedPrompt.replaceAll(variable, value);
    });

    console.log(`[inject-variables] Processed ${variablesUsed.length} variables`);

    return new Response(
      JSON.stringify({
        processedPrompt,
        variablesUsed,
        context
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[inject-variables] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
