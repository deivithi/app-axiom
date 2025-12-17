import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { userId, conversationId, messages } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Format conversation for analysis
    const conversationText = messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    console.log(`Extracting memories from conversation for user: ${userId}`);

    // Use Lovable AI Gateway to extract memories
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você extrai informações-chave de conversas para criar memórias persistentes.
Analise a conversa e retorne um JSON com memórias relevantes.

TIPOS DE MEMÓRIA:
- personality: Preferências de comunicação, estilo pessoal (ex: "Prefere respostas diretas")
- routine: Padrões de rotina, horários (ex: "Mais produtivo à noite")
- goal: Metas e objetivos (ex: "Meta: Score 750 até março")
- pattern: Comportamentos recorrentes (ex: "Revisa tarefas toda manhã")
- preference: Preferências gerais (ex: "Prefere voz em mobile")
- fact: Fatos sobre o usuário (ex: "Trabalha como PO na Febracis")
- insight: Descobertas sobre padrões comportamentais

REGRAS:
- Só extraia memórias NOVAS e RELEVANTES
- Não extraia informações triviais ou efêmeras
- Confidence: 1-5 (5 = muito certo, 1 = inferido)
- Cada memória deve ser uma frase clara e autossuficiente

FORMATO DE RESPOSTA (JSON):
{
  "memories": [
    {
      "type": "goal",
      "content": "Descrição clara da memória",
      "topics": ["Score", "Objetivos"],
      "confidence": 5
    }
  ]
}

Se não houver memórias relevantes, retorne: {"memories": []}`
          },
          {
            role: "user",
            content: conversationText
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const extracted = JSON.parse(data.choices[0].message.content || '{"memories": []}');
    
    console.log(`Extracted ${extracted.memories?.length || 0} memories`);

    const createdMemories = [];

    for (const mem of extracted.memories || []) {
      // Check for duplicates (similar content)
      const { data: existing } = await supabaseAdmin
        .from("memories")
        .select("id, content")
        .eq("user_id", userId)
        .eq("type", mem.type)
        .is("archived_at", null)
        .limit(50);

      // Simple duplicate check - could be enhanced with embeddings
      const isDuplicate = existing?.some((e: any) => 
        e.content.toLowerCase().includes(mem.content.toLowerCase().substring(0, 30)) ||
        mem.content.toLowerCase().includes(e.content.toLowerCase().substring(0, 30))
      );

      if (isDuplicate) {
        console.log(`Skipping duplicate memory: ${mem.content.substring(0, 50)}...`);
        continue;
      }

      // Create the memory
      const { data: memory, error } = await supabaseAdmin
        .from("memories")
        .insert({
          user_id: userId,
          type: mem.type,
          content: mem.content,
          context: {
            topics: mem.topics || [],
            relatedMemories: [],
            confidence: mem.confidence || 3
          },
          conversation_id: conversationId || null
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating memory:", error);
        continue;
      }

      console.log(`Created memory: ${mem.type} - ${mem.content.substring(0, 50)}...`);
      createdMemories.push(memory);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        memories_created: createdMemories.length,
        memories: createdMemories 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Extract memories error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
