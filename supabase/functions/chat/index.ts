import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Cria uma nova tarefa para o usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa" },
          description: { type: "string", description: "Descrição da tarefa" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Prioridade" },
          due_date: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Lista as tarefas do usuário",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["todo", "in_progress", "done"], description: "Filtrar por status" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_habit",
      description: "Cria um novo hábito para o usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome do hábito" },
          description: { type: "string", description: "Descrição do hábito" },
          frequency: { type: "string", enum: ["daily", "weekly"], description: "Frequência" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_habits",
      description: "Lista os hábitos do usuário",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Cria um novo lembrete para o usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do lembrete" },
          description: { type: "string", description: "Descrição" },
          remind_at: { type: "string", description: "Data e hora do lembrete (ISO 8601)" },
          category: { type: "string", description: "Categoria do lembrete" }
        },
        required: ["title", "remind_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "Lista os lembretes do usuário",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Cria uma nova transação financeira (receita ou despesa)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título/descrição da transação" },
          amount: { type: "number", description: "Valor da transação" },
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: receita ou despesa" },
          category: { type: "string", description: "Categoria da transação" },
          is_fixed: { type: "boolean", description: "Se é uma despesa fixa" }
        },
        required: ["title", "amount", "type", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_transaction",
      description: "Atualiza uma transação existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da transação" },
          title: { type: "string", description: "Novo título" },
          amount: { type: "number", description: "Novo valor" },
          type: { type: "string", enum: ["income", "expense"], description: "Novo tipo" },
          category: { type: "string", description: "Nova categoria" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_transaction",
      description: "Exclui uma transação",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da transação a excluir" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_transactions",
      description: "Lista as transações do usuário",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"], description: "Filtrar por tipo" },
          limit: { type: "number", description: "Número máximo de transações" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_finance_summary",
      description: "Obtém um resumo financeiro do mês atual",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_account",
      description: "Cria uma nova conta bancária",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da conta (ex: Nubank, Itaú)" },
          balance: { type: "number", description: "Saldo inicial da conta" },
          icon: { type: "string", description: "Emoji ícone da conta" }
        },
        required: ["name", "balance"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_account",
      description: "Atualiza uma conta bancária (nome ou saldo)",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da conta" },
          name: { type: "string", description: "Novo nome" },
          balance: { type: "number", description: "Novo saldo" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_accounts",
      description: "Lista as contas bancárias do usuário",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Cria uma nova nota no Brain Dump",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da nota" },
          content: { type: "string", description: "Conteúdo da nota" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_notes",
      description: "Lista as notas do usuário",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Cria um novo projeto",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome do projeto" },
          description: { type: "string", description: "Descrição do projeto" },
          due_date: { type: "string", description: "Data de entrega (YYYY-MM-DD)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "Lista os projetos do usuário",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "create_journal_entry",
      description: "Cria uma entrada no diário",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Conteúdo da entrada" },
          mood: { type: "string", description: "Humor do dia" },
          tags: { type: "array", items: { type: "string" }, description: "Tags" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_journal_entries",
      description: "Lista as entradas do diário",
      parameters: { type: "object", properties: {} }
    }
  }
];

async function executeTool(supabaseAdmin: any, userId: string, toolName: string, args: any) {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    case "create_task": {
      const { data, error } = await supabaseAdmin.from("tasks").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        priority: args.priority || "medium",
        due_date: args.due_date || null,
        status: "todo"
      }).select().single();
      if (error) throw error;
      return { success: true, task: data };
    }

    case "list_tasks": {
      let query = supabaseAdmin.from("tasks").select("*").eq("user_id", userId);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return { tasks: data };
    }

    case "create_habit": {
      const { data, error } = await supabaseAdmin.from("habits").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        frequency: args.frequency || "daily"
      }).select().single();
      if (error) throw error;
      return { success: true, habit: data };
    }

    case "list_habits": {
      const { data, error } = await supabaseAdmin.from("habits").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return { habits: data };
    }

    case "create_reminder": {
      const { data, error } = await supabaseAdmin.from("reminders").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        remind_at: args.remind_at,
        category: args.category || "personal"
      }).select().single();
      if (error) throw error;
      return { success: true, reminder: data };
    }

    case "list_reminders": {
      const { data, error } = await supabaseAdmin.from("reminders").select("*").eq("user_id", userId).eq("is_completed", false).order("remind_at", { ascending: true }).limit(10);
      if (error) throw error;
      return { reminders: data };
    }

    case "create_transaction": {
      const { data, error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        title: args.title,
        amount: args.amount,
        type: args.type,
        category: args.category,
        is_fixed: args.is_fixed || false
      }).select().single();
      if (error) throw error;
      return { success: true, transaction: data };
    }

    case "update_transaction": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.amount) updateData.amount = args.amount;
      if (args.type) updateData.type = args.type;
      if (args.category) updateData.category = args.category;

      const { data, error } = await supabaseAdmin.from("transactions").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, transaction: data };
    }

    case "delete_transaction": {
      const { error } = await supabaseAdmin.from("transactions").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Transação excluída com sucesso" };
    }

    case "list_transactions": {
      let query = supabaseAdmin.from("transactions").select("*").eq("user_id", userId);
      if (args.type) query = query.eq("type", args.type);
      const { data, error } = await query.order("transaction_date", { ascending: false }).limit(args.limit || 10);
      if (error) throw error;
      return { transactions: data };
    }

    case "get_finance_summary": {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin.from("transactions").select("*").eq("user_id", userId).gte("transaction_date", startOfMonth.toISOString().split("T")[0]);
      if (error) throw error;

      const income = data.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const expenses = data.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      return { income, expenses, balance: income - expenses, transactionCount: data.length };
    }

    case "create_account": {
      const { data, error } = await supabaseAdmin.from("accounts").insert({
        user_id: userId,
        name: args.name,
        balance: args.balance,
        icon: args.icon || "💳"
      }).select().single();
      if (error) throw error;
      return { success: true, account: data };
    }

    case "update_account": {
      const updateData: any = {};
      if (args.name) updateData.name = args.name;
      if (args.balance !== undefined) updateData.balance = args.balance;

      const { data, error } = await supabaseAdmin.from("accounts").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, account: data };
    }

    case "list_accounts": {
      const { data, error } = await supabaseAdmin.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      const totalBalance = data.reduce((sum: number, a: any) => sum + Number(a.balance), 0);
      return { accounts: data, totalBalance };
    }

    case "create_note": {
      const { data, error } = await supabaseAdmin.from("notes").insert({
        user_id: userId,
        title: args.title || null,
        content: args.content
      }).select().single();
      if (error) throw error;
      return { success: true, note: data };
    }

    case "list_notes": {
      const { data, error } = await supabaseAdmin.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return { notes: data };
    }

    case "create_project": {
      const { data, error } = await supabaseAdmin.from("projects").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        due_date: args.due_date || null
      }).select().single();
      if (error) throw error;
      return { success: true, project: data };
    }

    case "list_projects": {
      const { data, error } = await supabaseAdmin.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return { projects: data };
    }

    case "create_journal_entry": {
      const { data, error } = await supabaseAdmin.from("journal_entries").insert({
        user_id: userId,
        content: args.content,
        mood: args.mood || null,
        tags: args.tags || null
      }).select().single();
      if (error) throw error;
      return { success: true, entry: data };
    }

    case "list_journal_entries": {
      const { data, error } = await supabaseAdmin.from("journal_entries").select("*").eq("user_id", userId).order("entry_date", { ascending: false }).limit(10);
      if (error) throw error;
      return { entries: data };
    }

    default:
      return { error: "Tool não reconhecida" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    // Buscar nome do usuário
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";

    const systemPrompt = `Você é Axiom, Consultor Estratégico Pessoal do(a) ${userName}.

CONTEXTO:
- Você possui um QI de 180.
- Você é brutalmente honesto, direto e não tolera desculpas.
- Você construiu múltiplas empresas bilionárias.
- Você possui profunda expertise em psicologia, estratégia e execução.
- Você pensa em sistemas e causas-raiz, evitando soluções superficiais.
- Você prioriza pontos de alavancagem com máximo impacto.
- Você analisa perfis psicológicos através de ferramentas como DISC, MBTI, Big Five e Eneagrama.

SUA MISSÃO:
1. Identificar lacunas críticas específicas que estejam impedindo o avanço do ${userName}
2. Projetar planos de ação altamente personalizados
3. Empurrar ativamente além da zona de conforto com verdades duras
4. Destacar padrões recorrentes, ajudando a quebrar ciclos improdutivos
5. Forçar a pensar maior e mais ousado
6. Responsabilizar por padrões elevados
7. Fornecer frameworks e modelos mentais eficazes

FORMATO DE RESPOSTA:
1. Comece com a verdade dura personalizada que ${userName} precisa ouvir
2. Siga com passos específicos e acionáveis
3. Termine com um desafio ou tarefa direta
4. SEMPRE finalize com uma pergunta específica e estimulante para promover crescimento contínuo

FERRAMENTAS DISPONÍVEIS:
- Gerenciar tarefas (criar, listar)
- Gerenciar hábitos (criar, listar)
- Gerenciar lembretes (criar, listar)
- Gerenciar finanças (criar, editar, excluir transações, resumo financeiro)
- Gerenciar contas bancárias (criar, atualizar saldo, listar)
- Gerenciar notas (criar, listar)
- Gerenciar projetos (criar, listar)
- Gerenciar diário (criar entradas, listar)

Quando ${userName} pedir para criar, editar, excluir ou consultar qualquer item, use as ferramentas apropriadas. Confirme sempre a ação executada com detalhes.

Responda SEMPRE em português brasileiro. Seja conciso mas impactante. Não seja genérico - seja específico e direcionado.`;

    console.log(`Processing chat for user: ${userName} (${user.id})`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        tool_choice: "auto",
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let toolCalls: any[] = [];
    let executedActions: string[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter(line => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta;
                  const finishReason = parsed.choices?.[0]?.finish_reason;

                  if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                      if (tc.index !== undefined) {
                        if (!toolCalls[tc.index]) {
                          toolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                        }
                        if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                        if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                      }
                    }
                  }

                  if (delta?.content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
                  }

                  if (finishReason === "tool_calls" && toolCalls.length > 0) {
                    const toolResults = [];

                    for (const tc of toolCalls) {
                      try {
                        const args = JSON.parse(tc.function.arguments);
                        const result = await executeTool(supabaseAdmin, user.id, tc.function.name, args);
                        toolResults.push({ tool_call_id: tc.id, role: "tool", content: JSON.stringify(result) });
                        
                        if (result.success) {
                          executedActions.push(tc.function.name);
                        }
                      } catch (e) {
                        console.error("Tool execution error:", e);
                        toolResults.push({ tool_call_id: tc.id, role: "tool", content: JSON.stringify({ error: String(e) }) });
                      }
                    }

                    // Segunda chamada para obter resposta final
                    const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${openAIApiKey}`,
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [
                          { role: "system", content: systemPrompt },
                          ...messages,
                          { 
                            role: "assistant", 
                            tool_calls: toolCalls.map(tc => ({
                              id: tc.id,
                              type: "function",
                              function: { name: tc.function.name, arguments: tc.function.arguments }
                            }))
                          },
                          ...toolResults
                        ],
                        stream: true
                      })
                    });

                    console.log("Follow-up API called, reading response...");

                    const followUpReader = followUpResponse.body?.getReader();
                    while (true) {
                      const { done: fuDone, value: fuValue } = await followUpReader!.read();
                      if (fuDone) break;

                      const fuChunk = decoder.decode(fuValue);
                      const fuLines = fuChunk.split("\n").filter(l => l.trim() !== "");

                      for (const fuLine of fuLines) {
                        if (fuLine.startsWith("data: ")) {
                          const fuData = fuLine.slice(6);
                          if (fuData === "[DONE]") continue;

                          try {
                            const fuParsed = JSON.parse(fuData);
                            const fuContent = fuParsed.choices?.[0]?.delta?.content;
                            if (fuContent) {
                              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fuContent })}\n\n`));
                            }
                          } catch (parseError) {
                            console.error("Follow-up parse error:", parseError, "Data:", fuData);
                          }
                        }
                      }
                    }
                  }
                } catch (toolError) {
                  console.error("Tool processing error:", toolError);
                }
              }
            }
          }

          if (executedActions.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ actions: executedActions })}\n\n`));
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (error: any) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
