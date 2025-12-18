import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to delete in order (child tables first, then parent tables)
const TABLES_TO_DELETE = [
  "habit_logs",
  "project_tasks",
  "transactions",
  "accounts",
  "habits",
  "projects",
  "reminders",
  "notes",
  "journal_entries",
  "messages",
  "tasks",
  "memories",
  "conversations",
  "axiom_score_history",
  "financial_goals",
  "saved_sites",
  "push_subscriptions",
  "proactive_questions",
  "prompt_library",
];

async function deleteUserData(supabase: any, userId: string): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  console.log(`[process-scheduled-deletions] Deleting data for user: ${userId.substring(0, 8)}...`);

  // Delete from all tables
  for (const table of TABLES_TO_DELETE) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("user_id", userId);

      if (error) {
        console.error(`[process-scheduled-deletions] Error deleting from ${table}:`, error.message);
        errors.push(`${table}: ${error.message}`);
      } else {
        console.log(`[process-scheduled-deletions] Deleted from ${table}`);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      errors.push(`${table}: ${errorMessage}`);
    }
  }

  // Delete avatars from storage
  try {
    await supabase.storage
      .from("avatars")
      .remove([
        `${userId}/avatar.png`,
        `${userId}/avatar.jpg`,
        `${userId}/avatar.jpeg`,
        `${userId}/avatar.webp`,
      ]);
    console.log(`[process-scheduled-deletions] Deleted avatars`);
  } catch {
    // Silent fail on storage cleanup
  }

  // Soft delete profile (keep record but mark as deleted)
  try {
    await supabase
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        user_context: null,
        avatar_url: null,
        full_name: "[Usuário Excluído]",
      })
      .eq("id", userId);
    console.log(`[process-scheduled-deletions] Soft deleted profile`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    errors.push(`profiles: ${errorMessage}`);
  }

  return { success: errors.length === 0, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[process-scheduled-deletions] Starting scheduled deletion processing...");

    // Find all confirmed deletions that are past their scheduled date
    const { data: pendingDeletions, error: fetchError } = await supabase
      .from("scheduled_deletions")
      .select("id, user_id")
      .eq("status", "confirmed")
      .lte("scheduled_for", new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
      console.log("[process-scheduled-deletions] No pending deletions to process");
      return new Response(
        JSON.stringify({ processed: 0, message: "No deletions to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-scheduled-deletions] Found ${pendingDeletions.length} deletion(s) to process`);

    const results: { userId: string; success: boolean; errors: string[] }[] = [];

    for (const deletion of pendingDeletions) {
      const { success, errors } = await deleteUserData(supabase, deletion.user_id);

      // Mark deletion as executed
      await supabase
        .from("scheduled_deletions")
        .update({
          status: "executed",
          executed_at: new Date().toISOString(),
        })
        .eq("id", deletion.id);

      results.push({
        userId: deletion.user_id.substring(0, 8) + "...",
        success,
        errors,
      });

      // Delete the auth user (this will cascade delete the profile due to ON DELETE CASCADE)
      try {
        await supabase.auth.admin.deleteUser(deletion.user_id);
        console.log(`[process-scheduled-deletions] Auth user deleted: ${deletion.user_id.substring(0, 8)}...`);
      } catch (authError) {
        console.error(`[process-scheduled-deletions] Error deleting auth user:`, authError);
      }
    }

    console.log(`[process-scheduled-deletions] Completed processing ${results.length} deletion(s)`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[process-scheduled-deletions] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
