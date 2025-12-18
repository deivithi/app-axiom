import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to get safe day for a month (handles Feb 31 -> Feb 28 etc)
function getSafeDayForMonth(year: number, month: number, desiredDay: number): number {
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(desiredDay, lastDayOfMonth);
}

// Helper to get Brazil date info
function getBrazilDate(): { year: number; month: number; day: number; referenceMonth: string; dateStr: string } {
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = brazilTime.getFullYear();
  const month = brazilTime.getMonth();
  const day = brazilTime.getDate();
  const monthStr = String(month + 1).padStart(2, '0');
  
  return {
    year,
    month,
    day,
    referenceMonth: `${year}-${monthStr}`,
    dateStr: `${year}-${monthStr}-${String(day).padStart(2, '0')}`
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting generate-recurring-transactions job");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const brazil = getBrazilDate();
    console.log(`Processing for date: ${brazil.dateStr}, reference month: ${brazil.referenceMonth}`);

    // Fetch all fixed transactions that are parent transactions (not children)
    const { data: fixedTransactions, error: fetchError } = await supabase
      .from("transactions")
      .select("*")
      .eq("is_fixed", true)
      .is("parent_transaction_id", null);

    if (fetchError) {
      console.error("Error fetching fixed transactions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${fixedTransactions?.length || 0} fixed parent transactions`);

    let created = 0;
    let skipped = 0;

    for (const original of fixedTransactions || []) {
      // Get the recurrence day (default to day 1 if not set)
      const recurrenceDay = original.recurrence_day || 1;
      
      // Calculate the safe day for the current month
      const safeDay = getSafeDayForMonth(brazil.year, brazil.month, recurrenceDay);
      
      // Check if today matches the recurrence day (or safe day)
      const todayMatchesRecurrence = brazil.day === safeDay;
      
      // Also check if an instance for this month already exists
      const { data: existing, error: existingError } = await supabase
        .from("transactions")
        .select("id")
        .eq("parent_transaction_id", original.id)
        .eq("reference_month", brazil.referenceMonth)
        .maybeSingle();

      if (existingError) {
        console.error(`Error checking existing instance for ${original.id}:`, existingError);
        continue;
      }

      // Skip if instance already exists
      if (existing) {
        skipped++;
        continue;
      }

      // Skip if original was created in the current month (it's the first instance)
      const originalDate = new Date(original.transaction_date + 'T12:00:00');
      const originalMonth = `${originalDate.getFullYear()}-${String(originalDate.getMonth() + 1).padStart(2, '0')}`;
      if (originalMonth === brazil.referenceMonth) {
        skipped++;
        continue;
      }

      // Create instance for this month on the correct day
      const transactionDate = `${brazil.year}-${String(brazil.month + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
      
      const { error: insertError } = await supabase.from("transactions").insert({
        user_id: original.user_id,
        title: original.title,
        amount: original.amount,
        type: original.type,
        category: original.category,
        is_fixed: true,
        is_paid: false,
        is_installment: false,
        payment_method: original.payment_method,
        parent_transaction_id: original.id,
        reference_month: brazil.referenceMonth,
        transaction_date: transactionDate,
        account_id: original.account_id,
        recurrence_day: recurrenceDay
      });

      if (insertError) {
        console.error(`Error creating instance for ${original.id}:`, insertError);
        continue;
      }

      created++;
      console.log(`Created instance for "${original.title}" on ${transactionDate}`);
    }

    console.log(`Job complete: ${created} created, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${created} recurring transactions, skipped ${skipped}`,
        date: brazil.dateStr,
        referenceMonth: brazil.referenceMonth
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in generate-recurring-transactions:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
