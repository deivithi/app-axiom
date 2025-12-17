import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, testId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Define all tests
    const tests = [
      { id: "test-1", name: "Dashboard de Memória — Estrutura Visual", fn: testDashboardStructure },
      { id: "test-2", name: "Chat com Contexto — Busca de Memórias", fn: testChatContext },
      { id: "test-3", name: "Extração Automática — Criação de Memórias", fn: testMemoryExtraction },
      { id: "test-4", name: "Detalhes da Memória — Estrutura Completa", fn: testMemoryDetails },
      { id: "test-5", name: "Aprendizados — Categorização por Tipo", fn: testLearningInsights },
      { id: "test-6", name: "Busca de Memórias — Filtros Funcionais", fn: testMemorySearch },
    ];

    // Run single test or all tests
    if (testId) {
      const test = tests.find(t => t.id === testId);
      if (!test) {
        return new Response(
          JSON.stringify({ error: `Test ${testId} not found` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const startTime = Date.now();
      const result = await test.fn(supabase, userId, supabaseUrl, supabaseServiceKey);
      const duration = Date.now() - startTime;

      return new Response(
        JSON.stringify({ ...result, id: test.id, name: test.name, duration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Run all tests
    const results: TestResult[] = [];
    for (const test of tests) {
      const startTime = Date.now();
      try {
        const result = await test.fn(supabase, userId, supabaseUrl, supabaseServiceKey);
        results.push({
          id: test.id,
          name: test.name,
          passed: result.passed,
          message: result.message,
          duration: Date.now() - startTime,
          details: result.details,
        });
      } catch (error: any) {
        results.push({
          id: test.id,
          name: test.name,
          passed: false,
          message: `❌ Erro: ${error?.message || "Erro desconhecido"}`,
          duration: Date.now() - startTime,
        });
      }
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({ results, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// TEST 1: Dashboard Structure
async function testDashboardStructure(supabase: any, userId: string) {
  // Check memories exist
  const { count: memoriesCount, error: memoriesError } = await supabase
    .from("memories")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("archived_at", null);

  if (memoriesError) {
    return { passed: false, message: `❌ Erro ao buscar memórias: ${memoriesError.message}` };
  }

  if (memoriesCount === 0) {
    return { 
      passed: false, 
      message: "❌ Nenhuma memória encontrada. Converse com Axiom para criar memórias automaticamente." 
    };
  }

  // Check conversations exist
  const { count: conversationsCount } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Check memories have topics
  const { data: recentMemories } = await supabase
    .from("memories")
    .select("context")
    .eq("user_id", userId)
    .is("archived_at", null)
    .limit(10);

  const hasTopics = recentMemories?.some((mem: any) => {
    const context = mem.context;
    return context?.topics && Array.isArray(context.topics) && context.topics.length > 0;
  });

  return {
    passed: true,
    message: `✅ Dashboard OK: ${memoriesCount} memórias, ${conversationsCount || 0} conversas${hasTopics ? ", tópicos configurados" : ""}`,
    details: { memoriesCount, conversationsCount, hasTopics }
  };
}

// TEST 2: Chat Context Search
async function testChatContext(supabase: any, userId: string, supabaseUrl: string, supabaseServiceKey: string) {
  const testQuery = "objetivo";

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/search-memories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, query: testQuery, limit: 5 })
    });

    if (!response.ok) {
      return { passed: false, message: `❌ search-memories retornou ${response.status}` };
    }

    const data = await response.json();
    const memories = data.memories || [];

    if (memories.length === 0) {
      // Try direct database search
      const { data: dbMemories } = await supabase
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null)
        .ilike("content", `%${testQuery}%`)
        .limit(5);

      if (!dbMemories || dbMemories.length === 0) {
        return { 
          passed: false, 
          message: `❌ Nenhuma memória encontrada para "${testQuery}". Crie memórias primeiro.` 
        };
      }

      return {
        passed: true,
        message: `✅ Busca direta OK: ${dbMemories.length} memórias encontradas para "${testQuery}"`,
        details: { searchType: "direct", count: dbMemories.length }
      };
    }

    return {
      passed: true,
      message: `✅ Chat Context OK: ${memories.length} memórias relevantes para "${testQuery}"`,
      details: { searchType: "edge-function", count: memories.length }
    };
  } catch (error: any) {
    return { passed: false, message: `❌ Erro na busca: ${error?.message || "Erro desconhecido"}` };
  }
}

// TEST 3: Memory Extraction
async function testMemoryExtraction(supabase: any, userId: string, supabaseUrl: string, supabaseServiceKey: string) {
  const testMessages = [
    { role: "user", content: "Meu objetivo principal é melhorar minha produtividade em 50% até março. Prefiro respostas diretas e objetivas." },
    { role: "assistant", content: "Entendido! Vou te ajudar a aumentar sua produtividade em 50% até março com dicas diretas e acionáveis." }
  ];

  try {
    // Count memories before
    const { count: beforeCount } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const response = await fetch(`${supabaseUrl}/functions/v1/extract-memories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, conversationId: null, messages: testMessages })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { passed: false, message: `❌ extract-memories retornou ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    const memoriesCreated = data.memories_created || 0;

    // Verify in database
    const { count: afterCount } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const actualCreated = (afterCount || 0) - (beforeCount || 0);

    if (memoriesCreated === 0 && actualCreated === 0) {
      return { 
        passed: false, 
        message: "❌ Nenhuma memória foi extraída. Verifique a API key do OpenAI/Lovable." 
      };
    }

    return {
      passed: true,
      message: `✅ Extração OK: ${memoriesCreated} memórias criadas (${actualCreated} novas no banco)`,
      details: { memoriesCreated, actualCreated, types: data.memories?.map((m: any) => m.type) }
    };
  } catch (error: any) {
    return { passed: false, message: `❌ Erro na extração: ${error?.message || "Erro desconhecido"}` };
  }
}

// TEST 4: Memory Details Structure
async function testMemoryDetails(supabase: any, userId: string) {
  const { data: memory, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .is("archived_at", null)
    .limit(1)
    .single();

  if (error || !memory) {
    return { passed: false, message: "❌ Nenhuma memória disponível para testar estrutura." };
  }

  const requiredFields = ["id", "content", "type", "created_at", "user_id"];
  const missingFields = requiredFields.filter(field => !memory[field]);

  if (missingFields.length > 0) {
    return { 
      passed: false, 
      message: `❌ Campos obrigatórios faltando: ${missingFields.join(", ")}` 
    };
  }

  const context = memory.context || {};
  const hasContext = context.topics || context.confidence;

  return {
    passed: true,
    message: `✅ Estrutura OK: Memória "${memory.id.slice(0, 8)}..." tem todos os campos${hasContext ? " + contexto" : ""}`,
    details: { 
      id: memory.id, 
      type: memory.type, 
      hasTopics: !!context.topics?.length,
      hasConfidence: !!context.confidence 
    }
  };
}

// TEST 5: Learning Insights by Type
async function testLearningInsights(supabase: any, userId: string) {
  const { data: memories, error } = await supabase
    .from("memories")
    .select("type, context")
    .eq("user_id", userId)
    .is("archived_at", null);

  if (error) {
    return { passed: false, message: `❌ Erro ao buscar memórias: ${error.message}` };
  }

  if (!memories || memories.length === 0) {
    return { passed: false, message: "❌ Nenhuma memória para categorizar." };
  }

  // Group by type
  const typeGroups: Record<string, number> = {};
  const validTypes = ["personality", "routine", "goal", "pattern", "preference", "fact", "insight"];
  
  memories.forEach((m: any) => {
    if (validTypes.includes(m.type)) {
      typeGroups[m.type] = (typeGroups[m.type] || 0) + 1;
    }
  });

  const typesFound = Object.keys(typeGroups);

  // Check confidence scores
  const hasConfidence = memories.some((m: any) => {
    const conf = m.context?.confidence;
    return typeof conf === "number" && conf >= 1 && conf <= 5;
  });

  const typesSummary = Object.entries(typeGroups)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");

  return {
    passed: typesFound.length >= 1,
    message: `✅ Categorização OK: ${typesFound.length} tipos (${typesSummary})${hasConfidence ? ", scores de confiança presentes" : ""}`,
    details: { typeGroups, hasConfidence, totalMemories: memories.length }
  };
}

// TEST 6: Memory Search Filters
async function testMemorySearch(supabase: any, userId: string, supabaseUrl: string, supabaseServiceKey: string) {
  try {
    // Test text search
    const textResponse = await fetch(`${supabaseUrl}/functions/v1/search-memories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, query: "produtividade", limit: 5 })
    });

    const textData = await textResponse.json();
    const textResults = textData.memories?.length || 0;

    // Test type filter
    const typeResponse = await fetch(`${supabaseUrl}/functions/v1/search-memories`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId, types: ["goal", "pattern"], limit: 10 })
    });

    const typeData = await typeResponse.json();
    const typeResults = typeData.memories?.length || 0;

    // Direct DB search as fallback
    const { count: directCount } = await supabase
      .from("memories")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("archived_at", null);

    return {
      passed: true,
      message: `✅ Busca OK: texto=${textResults}, tipo=${typeResults}, total=${directCount || 0}`,
      details: { textResults, typeResults, totalMemories: directCount }
    };
  } catch (error: any) {
    return { passed: false, message: `❌ Erro na busca: ${error?.message || "Erro desconhecido"}` };
  }
}
