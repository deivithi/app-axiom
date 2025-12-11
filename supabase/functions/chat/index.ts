import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tools definitions for Jarvis
const tools = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Criar uma nova tarefa no sistema de tarefas do usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa" },
          description: { type: "string", description: "Descrição opcional da tarefa" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Prioridade: low, medium ou high" },
          status: { type: "string", enum: ["todo", "doing", "done"], description: "Status: todo, doing ou done" },
          due_date: { type: "string", description: "Data limite no formato ISO (YYYY-MM-DD)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_habit",
      description: "Criar um novo hábito para o usuário acompanhar",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome do hábito" },
          description: { type: "string", description: "Descrição do hábito" },
          frequency: { type: "string", enum: ["daily", "weekly"], description: "Frequência: daily ou weekly" },
          color: { type: "string", description: "Cor em hexadecimal (ex: #8B5CF6)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Criar um novo lembrete para o usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do lembrete" },
          description: { type: "string", description: "Descrição do lembrete" },
          remind_at: { type: "string", description: "Data e hora do lembrete no formato ISO" },
          category: { type: "string", enum: ["personal", "work", "health", "finance"], description: "Categoria do lembrete" },
          is_recurring: { type: "boolean", description: "Se é um lembrete recorrente" },
          recurrence_type: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Tipo de recorrência" }
        },
        required: ["title", "remind_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Registrar uma nova transação financeira (receita ou despesa)",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Descrição da transação" },
          amount: { type: "number", description: "Valor da transação" },
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: income (receita) ou expense (despesa)" },
          category: { type: "string", description: "Categoria da transação (ex: alimentação, transporte, salário)" },
          transaction_date: { type: "string", description: "Data da transação (YYYY-MM-DD)" },
          is_fixed: { type: "boolean", description: "Se é uma despesa/receita fixa" },
          is_installment: { type: "boolean", description: "Se é parcelado" },
          total_installments: { type: "number", description: "Total de parcelas" },
          current_installment: { type: "number", description: "Parcela atual" }
        },
        required: ["title", "amount", "type", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_note",
      description: "Criar uma nova nota no Brain Dump do usuário",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da nota" },
          content: { type: "string", description: "Conteúdo da nota" },
          is_pinned: { type: "boolean", description: "Se a nota deve ser fixada" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Criar um novo projeto",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome do projeto" },
          description: { type: "string", description: "Descrição do projeto" },
          status: { type: "string", enum: ["active", "completed", "on_hold"], description: "Status do projeto" },
          due_date: { type: "string", description: "Data limite do projeto (YYYY-MM-DD)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_journal_entry",
      description: "Criar uma entrada no diário do usuário",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "Conteúdo da entrada do diário" },
          mood: { type: "string", enum: ["😊", "😐", "😢", "😡", "😴"], description: "Humor do dia" },
          entry_date: { type: "string", description: "Data da entrada (YYYY-MM-DD)" }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Listar as tarefas do usuário com opção de filtro por status",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["todo", "doing", "done", "all"], description: "Filtrar por status" },
          limit: { type: "number", description: "Quantidade máxima de tarefas" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "Listar os lembretes pendentes do usuário",
      parameters: {
        type: "object",
        properties: {
          include_completed: { type: "boolean", description: "Incluir lembretes já completados" },
          limit: { type: "number", description: "Quantidade máxima" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_finance_summary",
      description: "Obter resumo financeiro do usuário (receitas, despesas, saldo)",
      parameters: {
        type: "object",
        properties: {
          month: { type: "number", description: "Mês (1-12)" },
          year: { type: "number", description: "Ano (ex: 2024)" }
        }
      }
    }
  }
];

// Execute tool calls
async function executeTool(supabaseAdmin: any, userId: string, toolName: string, args: any) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  try {
    switch (toolName) {
      case "create_task": {
        const { data, error } = await supabaseAdmin
          .from('tasks')
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            priority: args.priority || 'medium',
            status: args.status || 'todo',
            due_date: args.due_date || null
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, action: 'create_task', data, message: `Tarefa "${args.title}" criada com sucesso!` };
      }
      
      case "create_habit": {
        const { data, error } = await supabaseAdmin
          .from('habits')
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            frequency: args.frequency || 'daily',
            color: args.color || '#8B5CF6'
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, action: 'create_habit', data, message: `Hábito "${args.title}" criado com sucesso!` };
      }
      
      case "create_reminder": {
        const { data, error } = await supabaseAdmin
          .from('reminders')
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            remind_at: args.remind_at,
            category: args.category || 'personal',
            is_recurring: args.is_recurring || false,
            recurrence_type: args.recurrence_type || null
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, action: 'create_reminder', data, message: `Lembrete "${args.title}" criado para ${new Date(args.remind_at).toLocaleString('pt-BR')}!` };
      }
      
      case "create_transaction": {
        const { data, error } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            title: args.title,
            amount: args.amount,
            type: args.type,
            category: args.category,
            transaction_date: args.transaction_date || new Date().toISOString().split('T')[0],
            is_fixed: args.is_fixed || false,
            is_installment: args.is_installment || false,
            total_installments: args.total_installments || null,
            current_installment: args.current_installment || null
          })
          .select()
          .single();
        
        if (error) throw error;
        const typeLabel = args.type === 'income' ? 'Receita' : 'Despesa';
        return { success: true, action: 'create_transaction', data, message: `${typeLabel} de R$ ${args.amount.toFixed(2)} registrada: "${args.title}"` };
      }
      
      case "create_note": {
        const { data, error } = await supabaseAdmin
          .from('notes')
          .insert({
            user_id: userId,
            title: args.title || null,
            content: args.content,
            is_pinned: args.is_pinned || false
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, action: 'create_note', data, message: `Nota criada com sucesso!` };
      }
      
      case "create_project": {
        const { data, error } = await supabaseAdmin
          .from('projects')
          .insert({
            user_id: userId,
            title: args.title,
            description: args.description || null,
            status: args.status || 'active',
            due_date: args.due_date || null
          })
          .select()
          .single();
        
        if (error) throw error;
        return { success: true, action: 'create_project', data, message: `Projeto "${args.title}" criado com sucesso!` };
      }
      
      case "create_journal_entry": {
        const entryDate = args.entry_date || new Date().toISOString().split('T')[0];
        
        // Check if entry exists for this date
        const { data: existing } = await supabaseAdmin
          .from('journal_entries')
          .select('id')
          .eq('user_id', userId)
          .eq('entry_date', entryDate)
          .single();
        
        if (existing) {
          // Update existing entry
          const { data, error } = await supabaseAdmin
            .from('journal_entries')
            .update({
              content: args.content,
              mood: args.mood || null
            })
            .eq('id', existing.id)
            .select()
            .single();
          
          if (error) throw error;
          return { success: true, action: 'create_journal_entry', data, message: `Entrada do diário atualizada para ${entryDate}!` };
        } else {
          const { data, error } = await supabaseAdmin
            .from('journal_entries')
            .insert({
              user_id: userId,
              content: args.content,
              mood: args.mood || null,
              entry_date: entryDate
            })
            .select()
            .single();
          
          if (error) throw error;
          return { success: true, action: 'create_journal_entry', data, message: `Entrada do diário criada para ${entryDate}!` };
        }
      }
      
      case "list_tasks": {
        let query = supabaseAdmin
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (args.status && args.status !== 'all') {
          query = query.eq('status', args.status);
        }
        
        if (args.limit) {
          query = query.limit(args.limit);
        } else {
          query = query.limit(10);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return { success: true, action: 'list_tasks', data, message: `Encontradas ${data.length} tarefas.` };
      }
      
      case "list_reminders": {
        let query = supabaseAdmin
          .from('reminders')
          .select('*')
          .eq('user_id', userId)
          .order('remind_at', { ascending: true });
        
        if (!args.include_completed) {
          query = query.eq('is_completed', false);
        }
        
        if (args.limit) {
          query = query.limit(args.limit);
        } else {
          query = query.limit(10);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return { success: true, action: 'list_reminders', data, message: `Encontrados ${data.length} lembretes.` };
      }
      
      case "get_finance_summary": {
        const now = new Date();
        const month = args.month || (now.getMonth() + 1);
        const year = args.year || now.getFullYear();
        
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];
        
        const { data, error } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate);
        
        if (error) throw error;
        
        const income = data.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const expense = data.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        const balance = income - expense;
        
        return {
          success: true,
          action: 'get_finance_summary',
          data: { income, expense, balance, transactions: data.length, month, year },
          message: `Resumo de ${month}/${year}: Receitas R$ ${income.toFixed(2)}, Despesas R$ ${expense.toFixed(2)}, Saldo R$ ${balance.toFixed(2)}`
        };
      }
      
      default:
        return { success: false, error: `Tool ${toolName} not implemented` };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Get user ID and profile from auth header
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    let userName = 'usuário';
    
    if (authHeader && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
      
      // Get user profile name
      if (userId) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', userId)
          .single();
        
        if (profile?.full_name) {
          userName = profile.full_name;
        } else if (user?.email) {
          // Fallback to email name part
          userName = user.email.split('@')[0];
        }
      }
    }

    console.log('User name:', userName);
    console.log('Sending request to OpenAI with', messages.length, 'messages');

    const systemPrompt = `Você é Jarvis, um assistente pessoal inteligente e prestativo do(a) ${userName}.

INFORMAÇÕES DO USUÁRIO:
- Nome: ${userName}
- Sempre se refira ao usuário pelo nome quando apropriado
- Seja pessoal e amigável, como um assistente dedicado

VOCÊ TEM FERRAMENTAS DISPONÍVEIS para executar ações no sistema:
- Criar tarefas, hábitos, lembretes, projetos
- Registrar transações financeiras
- Criar notas e entradas no diário
- Listar tarefas e lembretes
- Obter resumo financeiro

REGRAS IMPORTANTES:
1. Quando o usuário pedir para CRIAR algo (tarefa, lembrete, etc), USE A FERRAMENTA correspondente
2. Quando o usuário perguntar sobre suas finanças, USE get_finance_summary
3. Quando o usuário quiser saber suas tarefas, USE list_tasks
4. SEMPRE confirme a ação executada com detalhes
5. Seja proativo e ofereça ajuda adicional
6. Use o nome do usuário (${userName}) de forma natural na conversa

FORMATOS DE DATA:
- Para due_date e transaction_date: use formato YYYY-MM-DD
- Para remind_at: use formato ISO completo (YYYY-MM-DDTHH:mm:ss)
- "Amanhã" = data de amanhã
- "Hoje" = data de hoje

Data atual: ${new Date().toISOString().split('T')[0]}

Responda sempre em português brasileiro.
Seja amigável, direto e ofereça sugestões práticas.`;

    // First call: get AI response (possibly with tool calls)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: userId ? tools : undefined,
        tool_choice: userId ? 'auto' : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: 'Chave da API OpenAI inválida.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Erro ao processar sua mensagem' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await response.json();
    console.log('OpenAI Response:', JSON.stringify(aiResponse, null, 2));

    const assistantMessage = aiResponse.choices?.[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;
    
    // If there are tool calls, execute them
    if (toolCalls && toolCalls.length > 0 && userId && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const toolResults: any[] = [];
      const executedActions: any[] = [];
      
      for (const toolCall of toolCalls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(supabaseAdmin, userId, toolCall.function.name, args);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
        
        if (result.success) {
          executedActions.push(result);
        }
      }
      
      // Second call: get final response with tool results
      const messagesWithTools = [
        { role: 'system', content: systemPrompt },
        ...messages,
        assistantMessage,
        ...toolResults
      ];
      
      const finalResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messagesWithTools,
          stream: true,
        }),
      });
      
      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error('Final response error:', errorText);
        throw new Error('Error getting final response');
      }
      
      // Return streamed response with executed actions header
      const headers = {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'X-Executed-Actions': JSON.stringify(executedActions),
      };
      
      return new Response(finalResponse.body, { headers });
    }
    
    // No tool calls, return streaming response directly
    const streamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
