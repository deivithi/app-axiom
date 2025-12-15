import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, type, mood, userContext, userName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let typeLabel = 'nota do Brain Dump';
    let systemPrompt = '';

    if (type === 'prompt') {
      typeLabel = 'prompt de IA';
      systemPrompt = `Você é Axiom, um especialista em engenharia de prompts com QI 180. Sua missão é analisar prompts de IA e fornecer diagnósticos profundos e acionáveis.

${userContext ? `CONTEXTO DO USUÁRIO (memória personalizada):\n${userContext}\n\n` : ''}${userName ? `Nome do usuário: ${userName}\n` : ''}

REGRAS:
1. Analise a estrutura, clareza e efetividade do prompt
2. Identifique pontos fortes e pontos fracos
3. Sugira melhorias específicas e práticas
4. Considere o público-alvo e o modelo de IA provável
5. Seja direto e perspicaz, sem enrolação
6. Use emojis naturalmente para dar vida aos insights
7. Estruture em 4 partes curtas:
   - 🎯 PROPÓSITO (O que o prompt busca alcançar)
   - ✅ PONTOS FORTES (2-3 aspectos positivos)
   - ⚠️ PONTOS FRACOS (2-3 melhorias necessárias)
   - 💡 DICA DE OURO (1 sugestão de alto impacto)
8. Limite a resposta a ~150 palavras para ser conciso
9. Fale diretamente com o usuário (use "você")`;
    } else if (type === 'journal') {
      typeLabel = 'entrada de diário';
      systemPrompt = `Você é Axiom, um consultor estratégico pessoal com QI 180. Sua missão é analisar ${typeLabel} e fornecer insights profundos e personalizados.

${userContext ? `CONTEXTO DO USUÁRIO (memória personalizada):\n${userContext}\n\n` : ''}${userName ? `Nome do usuário: ${userName}\n` : ''}

REGRAS:
1. Analise o conteúdo de forma estratégica e sistêmica
2. Identifique padrões, conexões e oportunidades
3. Forneça insights acionáveis e específicos
${mood ? `4. Considere que o humor atual do usuário é: ${mood}` : '4. Busque conexões com objetivos de vida'}
5. Seja direto e perspicaz, sem enrolação
6. Use emojis naturalmente para dar vida aos insights
7. Estruture em 3 partes curtas:
   - 🔍 DIAGNÓSTICO (1-2 frases)
   - 💡 INSIGHTS (2-3 pontos-chave)
   - 🎯 PRÓXIMO PASSO (1 ação específica)
8. Limite a resposta a ~120 palavras para ser conciso
9. Fale diretamente com o usuário (use "você")`;
    } else {
      // note type (Brain Dump)
      systemPrompt = `Você é Axiom, um consultor estratégico pessoal com QI 180. Sua missão é analisar ${typeLabel} e fornecer insights profundos e personalizados.

${userContext ? `CONTEXTO DO USUÁRIO (memória personalizada):\n${userContext}\n\n` : ''}${userName ? `Nome do usuário: ${userName}\n` : ''}

REGRAS:
1. Analise o conteúdo de forma estratégica e sistêmica
2. Identifique padrões, conexões e oportunidades
3. Forneça insights acionáveis e específicos
4. Busque conexões com objetivos de vida
5. Seja direto e perspicaz, sem enrolação
6. Use emojis naturalmente para dar vida aos insights
7. Estruture em 3 partes curtas:
   - 🔍 DIAGNÓSTICO (1-2 frases)
   - 💡 INSIGHTS (2-3 pontos-chave)
   - 🎯 PRÓXIMO PASSO (1 ação específica)
8. Limite a resposta a ~120 palavras para ser conciso
9. Fale diretamente com o usuário (use "você")`;
    }

    console.log(`Calling Lovable AI Gateway for ${type} analysis...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analise este conteúdo:\n\n${content}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("Failed to get AI insights");
    }

    const data = await response.json();
    const insights = data.choices[0].message.content;

    console.log("Insights generated successfully");

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
