import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeletionRequest {
  userId: string;
  userEmail: string;
  userName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { userId, userEmail, userName }: DeletionRequest = await req.json();

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: "userId and userEmail are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-deletion-confirmation] Processing deletion request for user: ${userId.substring(0, 8)}...`);

    // Calculate scheduled deletion date (30 days from now)
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);

    // Check if there's already a pending deletion
    const { data: existingDeletion } = await supabase
      .from("scheduled_deletions")
      .select("id, status, confirmation_token")
      .eq("user_id", userId)
      .single();

    let confirmationToken: string;

    if (existingDeletion && existingDeletion.status === "pending") {
      // Use existing token
      confirmationToken = existingDeletion.confirmation_token;
      console.log(`[send-deletion-confirmation] Using existing pending deletion`);
    } else if (existingDeletion) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from("scheduled_deletions")
        .update({
          status: "pending",
          confirmed: false,
          scheduled_for: scheduledFor.toISOString(),
          requested_at: new Date().toISOString(),
          cancelled_at: null,
          executed_at: null,
        })
        .eq("user_id", userId)
        .select("confirmation_token")
        .single();

      if (updateError) throw updateError;
      confirmationToken = updated.confirmation_token;
    } else {
      // Create new scheduled deletion
      const { data: newDeletion, error: insertError } = await supabase
        .from("scheduled_deletions")
        .insert({
          user_id: userId,
          scheduled_for: scheduledFor.toISOString(),
          status: "pending",
          confirmed: false,
        })
        .select("confirmation_token")
        .single();

      if (insertError) throw insertError;
      confirmationToken = newDeletion.confirmation_token;
    }

    // Update profile with deletion scheduled date
    await supabase
      .from("profiles")
      .update({ deletion_scheduled_for: scheduledFor.toISOString() })
      .eq("id", userId);

    // Get the app URL from referer or use default
    const appUrl = req.headers.get("origin") || "https://axiom.app";
    const cancelUrl = `${appUrl}/cancel-deletion/${confirmationToken}`;
    const confirmUrl = `${appUrl}/confirm-deletion/${confirmationToken}`;

    // Format date for email
    const formattedDate = scheduledFor.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Send confirmation email
    const { error: emailError } = await resend.emails.send({
      from: "Axiom <noreply@resend.dev>",
      to: [userEmail],
      subject: "⚠️ Confirmação de Exclusão de Conta - Axiom",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0b; color: #fafafa; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1a1a1b; border-radius: 12px; padding: 32px; border: 1px solid #27272a;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #8b5cf6; margin: 0; font-size: 28px;">⚠️ Axiom</h1>
            </div>
            
            <h2 style="color: #fafafa; margin-bottom: 16px;">Olá${userName ? `, ${userName}` : ""}!</h2>
            
            <p style="color: #a1a1aa; line-height: 1.6;">
              Recebemos sua solicitação de exclusão de conta. De acordo com a LGPD, você tem <strong style="color: #fafafa;">30 dias</strong> para cancelar esta ação.
            </p>
            
            <div style="background-color: #27272a; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #a1a1aa; margin: 0 0 8px 0; font-size: 14px;">Data de exclusão definitiva:</p>
              <p style="color: #ef4444; font-size: 20px; font-weight: bold; margin: 0;">${formattedDate}</p>
            </div>
            
            <p style="color: #a1a1aa; line-height: 1.6;">
              Para <strong style="color: #fafafa;">confirmar</strong> a exclusão (ação irreversível após 30 dias):
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${confirmUrl}" style="display: inline-block; background-color: #ef4444; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Confirmar Exclusão
              </a>
            </div>
            
            <p style="color: #a1a1aa; line-height: 1.6;">
              Para <strong style="color: #22c55e;">cancelar</strong> e manter sua conta:
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="${cancelUrl}" style="display: inline-block; background-color: #22c55e; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Cancelar Exclusão
              </a>
            </div>
            
            <div style="border-top: 1px solid #27272a; margin-top: 32px; padding-top: 24px;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">
                Se você não solicitou esta exclusão, clique em "Cancelar Exclusão" acima para manter sua conta segura.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("[send-deletion-confirmation] Email error:", emailError);
      throw emailError;
    }

    console.log(`[send-deletion-confirmation] Email sent successfully to ${userEmail.substring(0, 3)}...`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduledFor: scheduledFor.toISOString(),
        message: "Email de confirmação enviado",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[send-deletion-confirmation] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
