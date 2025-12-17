import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, query, types, topics, limit = 5 } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Searching memories for user ${userId}: "${query?.substring(0, 50)}..."`);

    // Build the query
    let dbQuery = supabaseAdmin
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null);

    // Filter by types if provided
    if (types && types.length > 0) {
      dbQuery = dbQuery.in("type", types);
    }

    // Text search if query is provided
    if (query) {
      dbQuery = dbQuery.ilike("content", `%${query}%`);
    }

    // Order by usage and recency
    const { data: memories, error } = await dbQuery
      .order("usage_count", { ascending: false })
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Search error:", error);
      throw error;
    }

    // Filter by topics if provided (JSON path filtering)
    let filteredMemories = memories || [];
    if (topics && topics.length > 0) {
      filteredMemories = filteredMemories.filter((mem: any) => {
        const memTopics = mem.context?.topics || [];
        return topics.some((t: string) => 
          memTopics.some((mt: string) => 
            mt.toLowerCase().includes(t.toLowerCase())
          )
        );
      });
    }

    console.log(`Found ${filteredMemories.length} memories`);

    return new Response(
      JSON.stringify({ memories: filteredMemories.slice(0, limit) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Search memories error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
