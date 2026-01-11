import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== INPUT VALIDATION =====
const ScoreRequestSchema = z.object({
  userId: z.string().uuid('Invalid userId format'),
  saveHistory: z.boolean().optional().default(true)
});

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

interface ScoreBreakdown {
  total_score: number;
  execution: { score: number; tasksCompleted: number; tasksTotal: number; rate: number };
  financial: { score: number; monthsPositive: number; totalMonths: number; rate: number };
  habits: { score: number; daysWithCompletion: number; totalDays: number; rate: number };
  projects: { score: number; activeProjects: number; projectsWithProgress: number; rate: number };
  clarity: { score: number; notesWithInsights: number; totalNotes: number; rate: number };
}

async function calculateScoreBreakdown(supabase: any, userId: string): Promise<ScoreBreakdown> {
  const now = getBrazilNow();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = getBrazilDateStr(thirtyDaysAgo);

  // 1. EXECUTION: Task completion rate (last 30 days)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("status, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgoStr);

  const tasksTotal = tasks?.length || 0;
  const tasksCompleted = tasks?.filter((t: any) => t.status === "done").length || 0;
  const executionRate = tasksTotal > 0 ? (tasksCompleted / tasksTotal) : 0;
  const executionScore = Math.round(executionRate * 200);

  // 2. FINANCIAL: Positive balance months (last 6 months)
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, type, transaction_date")
    .eq("user_id", userId)
    .gte("transaction_date", getBrazilDateStr(sixMonthsAgo));

  const monthlyBalances: Record<string, number> = {};
  transactions?.forEach((t: any) => {
    const month = t.transaction_date.substring(0, 7);
    if (!monthlyBalances[month]) monthlyBalances[month] = 0;
    monthlyBalances[month] += t.type === "income" ? Number(t.amount) : -Number(t.amount);
  });

  const totalMonths = Math.max(Object.keys(monthlyBalances).length, 1);
  const monthsPositive = Object.values(monthlyBalances).filter(b => b >= 0).length;
  const financialRate = monthsPositive / totalMonths;
  const financialScore = Math.round(financialRate * 200);

  // 3. HABITS: Days with at least one habit completed (last 30 days)
  const { data: habitLogs } = await supabase
    .from("habit_logs")
    .select("completed_at")
    .eq("user_id", userId)
    .gte("completed_at", thirtyDaysAgoStr);

  const uniqueDays = new Set(habitLogs?.map((l: any) => l.completed_at) || []);
  const daysWithCompletion = uniqueDays.size;
  const habitsRate = daysWithCompletion / 30;
  const habitsScore = Math.round(habitsRate * 200);

  // 4. PROJECTS: Projects with progress in last 7 days
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, updated_at, status")
    .eq("user_id", userId)
    .eq("status", "active");

  const activeProjects = projects?.length || 0;
  const projectsWithProgress = projects?.filter((p: any) => 
    new Date(p.updated_at) >= sevenDaysAgo
  ).length || 0;
  const projectsRate = activeProjects > 0 ? (projectsWithProgress / activeProjects) : 0;
  const projectsScore = Math.round(projectsRate * 200);

  // 5. CLARITY: Notes with AI insights processed (last 30 days)
  const { data: notes } = await supabase
    .from("notes")
    .select("ai_insights, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgoStr);

  const { data: journalEntries } = await supabase
    .from("journal_entries")
    .select("ai_insights, created_at")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgoStr);

  const totalNotes = (notes?.length || 0) + (journalEntries?.length || 0);
  const notesWithInsights = (notes?.filter((n: any) => n.ai_insights)?.length || 0) +
                            (journalEntries?.filter((j: any) => j.ai_insights)?.length || 0);
  const clarityRate = totalNotes > 0 ? (notesWithInsights / totalNotes) : 0;
  const clarityScore = Math.round(clarityRate * 200);

  const totalScore = executionScore + financialScore + habitsScore + projectsScore + clarityScore;

  return {
    total_score: totalScore,
    execution: { score: executionScore, tasksCompleted, tasksTotal, rate: Math.round(executionRate * 100) },
    financial: { score: financialScore, monthsPositive, totalMonths, rate: Math.round(financialRate * 100) },
    habits: { score: habitsScore, daysWithCompletion, totalDays: 30, rate: Math.round(habitsRate * 100) },
    projects: { score: projectsScore, activeProjects, projectsWithProgress, rate: Math.round(projectsRate * 100) },
    clarity: { score: clarityScore, notesWithInsights, totalNotes, rate: Math.round(clarityRate * 100) },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate input
    const body = await req.json();
    const parseResult = ScoreRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      return new Response(JSON.stringify({ 
        error: "Invalid input",
        details: parseResult.error.errors.map(e => e.message)
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const { userId, saveHistory } = parseResult.data;

    console.log(`Calculating score for user: ${userId}`);

    const breakdown = await calculateScoreBreakdown(supabase, userId);

    // Save to history if requested
    if (saveHistory) {
      await supabase.from("axiom_score_history").insert({
        user_id: userId,
        total_score: breakdown.total_score,
        execution_score: breakdown.execution.score,
        financial_score: breakdown.financial.score,
        habits_score: breakdown.habits.score,
        projects_score: breakdown.projects.score,
        clarity_score: breakdown.clarity.score,
        breakdown: breakdown,
      });
    }

    console.log(`Score calculated: ${breakdown.total_score}`);

    return new Response(JSON.stringify(breakdown), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error calculating score:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
