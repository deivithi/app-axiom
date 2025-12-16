import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Web Push helper function using fetch API
async function sendWebPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<Response> {
  // For web push, we'll use a simplified approach via fetch
  // In production, you'd want to use proper VAPID signing
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TTL": "86400",
    },
    body: payload,
  });
  return response;
}

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: string;
  url?: string;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { userId, title, body, type, url, tag, actions } = payload;

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, title, body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending push notification to user ${userId}: ${title}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check user preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single();

    const preferences = profile?.notification_preferences || { enabled: false };

    if (!preferences.enabled) {
      console.log(`User ${userId} has notifications disabled`);
      return new Response(
        JSON.stringify({ message: "User has notifications disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check type-specific preferences
    const typePreferenceMap: Record<string, string> = {
      reminder: "reminders",
      proactive_question: "proactive_questions",
      score_drop: "score_drops",
      weekly_report: "weekly_report",
      bill_due: "bills_due",
      test: "enabled" // Always allow test if enabled
    };

    const preferenceKey = typePreferenceMap[type] || "enabled";
    if (!preferences[preferenceKey]) {
      console.log(`User ${userId} has ${type} notifications disabled`);
      return new Response(
        JSON.stringify({ message: `User has ${type} notifications disabled` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active subscriptions for user ${userId}`);
      return new Response(
        JSON.stringify({ message: "No active subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      type,
      url: url || "/",
      tag: tag || `axiom-${type}-${Date.now()}`,
      actions: actions || []
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        const response = await sendWebPush(pushSubscription, notificationPayload);
        
        if (!response.ok) {
          throw new Error(`Push failed with status ${response.status}`);
        }
        
        // Update last_used_at
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id);

        return { success: true, endpoint: sub.endpoint };
      } catch (error: unknown) {
        const err = error as { statusCode?: number; message?: string };
        console.error(`Failed to send to ${sub.endpoint}:`, error);
        
        // If subscription is invalid, mark as inactive
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("id", sub.id);
        }
        
        return { success: false, endpoint: sub.endpoint, error: err.message || 'Unknown error' };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    console.log(`Sent ${successful}/${subscriptions.length} notifications`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successful}/${subscriptions.length} notifications`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
