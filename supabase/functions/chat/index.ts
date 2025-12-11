import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const tools = [
  // TASKS
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
          status: { type: "string", enum: ["todo", "doing", "done"], description: "Filtrar por status" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Atualiza uma tarefa existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da tarefa" },
          title: { type: "string", description: "Novo título" },
          description: { type: "string", description: "Nova descrição" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Nova prioridade" },
          status: { type: "string", enum: ["todo", "doing", "done"], description: "Novo status" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Exclui uma tarefa",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da tarefa a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // HABITS
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
          frequency: { type: "string", enum: ["daily", "weekly"], description: "Frequência" },
          color: { type: "string", description: "Cor do hábito em hex (ex: #8B5CF6)" }
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
      name: "update_habit",
      description: "Atualiza um hábito existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do hábito" },
          title: { type: "string", description: "Novo nome" },
          frequency: { type: "string", enum: ["daily", "weekly"], description: "Nova frequência" },
          color: { type: "string", description: "Nova cor em hex" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_habit",
      description: "Exclui um hábito",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do hábito a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // REMINDERS
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
          category: { type: "string", enum: ["personal", "work", "health", "other"], description: "Categoria do lembrete" }
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
      parameters: {
        type: "object",
        properties: {
          include_completed: { type: "boolean", description: "Incluir lembretes concluídos" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Atualiza um lembrete existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do lembrete" },
          title: { type: "string", description: "Novo título" },
          description: { type: "string", description: "Nova descrição" },
          remind_at: { type: "string", description: "Nova data/hora" },
          category: { type: "string", enum: ["personal", "work", "health", "other"], description: "Nova categoria" },
          is_completed: { type: "boolean", description: "Marcar como concluído ou pendente" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Exclui um lembrete",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do lembrete a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // TRANSACTIONS
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
          is_fixed: { type: "boolean", description: "Se é uma despesa fixa" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Forma de pagamento" }
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
          category: { type: "string", description: "Nova categoria" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Nova forma de pagamento" }
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
  // ACCOUNTS
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
      name: "delete_account",
      description: "Exclui uma conta bancária",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da conta a excluir" }
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
  // NOTES
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
      name: "update_note",
      description: "Atualiza uma nota existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da nota" },
          title: { type: "string", description: "Novo título" },
          content: { type: "string", description: "Novo conteúdo" },
          is_pinned: { type: "boolean", description: "Fixar/desafixar nota" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_note",
      description: "Exclui uma nota",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da nota a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // PROJECTS
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
      name: "update_project",
      description: "Atualiza um projeto existente",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do projeto" },
          title: { type: "string", description: "Novo nome" },
          description: { type: "string", description: "Nova descrição" },
          status: { type: "string", enum: ["active", "paused", "completed"], description: "Novo status" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description: "Exclui um projeto e todas suas subtarefas",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID do projeto a excluir" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_project_task",
      description: "Cria uma subtarefa em um projeto",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "ID do projeto" },
          title: { type: "string", description: "Título da subtarefa" }
        },
        required: ["project_id", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_project_task",
      description: "Exclui uma subtarefa de um projeto",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da subtarefa a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // JOURNAL
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
  },
  {
    type: "function",
    function: {
      name: "update_journal_entry",
      description: "Atualiza uma entrada do diário",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da entrada" },
          content: { type: "string", description: "Novo conteúdo" },
          mood: { type: "string", description: "Novo humor" },
          tags: { type: "array", items: { type: "string" }, description: "Novas tags" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_journal_entry",
      description: "Exclui uma entrada do diário",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "ID da entrada a excluir" }
        },
        required: ["id"]
      }
    }
  },
  // USER
  {
    type: "function",
    function: {
      name: "update_user_context",
      description: "Atualiza o contexto pessoal do usuário (informações sobre ele para personalização)",
      parameters: {
        type: "object",
        properties: {
          context: { type: "string", description: "Novo contexto pessoal do usuário" }
        },
        required: ["context"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_all_user_data",
      description: "Exclui todos os dados do usuário e começa do zero. Use apenas quando o usuário pedir explicitamente para resetar tudo.",
      parameters: { type: "object", properties: {} }
    }
  }
];

async function executeTool(supabaseAdmin: any, userId: string, toolName: string, args: any) {
  console.log(`Executing tool: ${toolName}`, args);

  switch (toolName) {
    // TASKS
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

    case "update_task": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.priority) updateData.priority = args.priority;
      if (args.status) updateData.status = args.status;

      const { data, error } = await supabaseAdmin.from("tasks").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, task: data };
    }

    case "delete_task": {
      const { error } = await supabaseAdmin.from("tasks").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Tarefa excluída com sucesso" };
    }

    // HABITS
    case "create_habit": {
      const { data, error } = await supabaseAdmin.from("habits").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        frequency: args.frequency || "daily",
        color: args.color || "#8B5CF6"
      }).select().single();
      if (error) throw error;
      return { success: true, habit: data };
    }

    case "list_habits": {
      const { data, error } = await supabaseAdmin.from("habits").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return { habits: data };
    }

    case "update_habit": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.frequency) updateData.frequency = args.frequency;
      if (args.color) updateData.color = args.color;

      const { data, error } = await supabaseAdmin.from("habits").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, habit: data };
    }

    case "delete_habit": {
      // First delete habit logs
      await supabaseAdmin.from("habit_logs").delete().eq("habit_id", args.id);
      const { error } = await supabaseAdmin.from("habits").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Hábito excluído com sucesso" };
    }

    // REMINDERS
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
      let query = supabaseAdmin.from("reminders").select("*").eq("user_id", userId);
      if (!args.include_completed) query = query.eq("is_completed", false);
      const { data, error } = await query.order("remind_at", { ascending: true }).limit(10);
      if (error) throw error;
      return { reminders: data };
    }

    case "update_reminder": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.remind_at) updateData.remind_at = args.remind_at;
      if (args.category) updateData.category = args.category;
      if (args.is_completed !== undefined) updateData.is_completed = args.is_completed;

      const { data, error } = await supabaseAdmin.from("reminders").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, reminder: data };
    }

    case "delete_reminder": {
      const { error } = await supabaseAdmin.from("reminders").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Lembrete excluído com sucesso" };
    }

    // TRANSACTIONS
    case "create_transaction": {
      const { data, error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        title: args.title,
        amount: args.amount,
        type: args.type,
        category: args.category,
        is_fixed: args.is_fixed || false,
        payment_method: args.payment_method || "PIX"
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
      if (args.payment_method) updateData.payment_method = args.payment_method;

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

    // ACCOUNTS
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

    case "delete_account": {
      const { error } = await supabaseAdmin.from("accounts").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Conta excluída com sucesso" };
    }

    case "list_accounts": {
      const { data, error } = await supabaseAdmin.from("accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      const totalBalance = data.reduce((sum: number, a: any) => sum + Number(a.balance), 0);
      return { accounts: data, totalBalance };
    }

    // NOTES
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

    case "update_note": {
      const updateData: any = {};
      if (args.title !== undefined) updateData.title = args.title;
      if (args.content) updateData.content = args.content;
      if (args.is_pinned !== undefined) updateData.is_pinned = args.is_pinned;

      const { data, error } = await supabaseAdmin.from("notes").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, note: data };
    }

    case "delete_note": {
      const { error } = await supabaseAdmin.from("notes").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Nota excluída com sucesso" };
    }

    // PROJECTS
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

    case "update_project": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.status) updateData.status = args.status;

      const { data, error } = await supabaseAdmin.from("projects").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, project: data };
    }

    case "delete_project": {
      // First delete project tasks
      await supabaseAdmin.from("project_tasks").delete().eq("project_id", args.id);
      const { error } = await supabaseAdmin.from("projects").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Projeto excluído com sucesso" };
    }

    case "create_project_task": {
      const { data, error } = await supabaseAdmin.from("project_tasks").insert({
        user_id: userId,
        project_id: args.project_id,
        title: args.title
      }).select().single();
      if (error) throw error;
      return { success: true, task: data };
    }

    case "delete_project_task": {
      const { error } = await supabaseAdmin.from("project_tasks").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Subtarefa excluída com sucesso" };
    }

    // JOURNAL
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

    case "update_journal_entry": {
      const updateData: any = {};
      if (args.content) updateData.content = args.content;
      if (args.mood !== undefined) updateData.mood = args.mood;
      if (args.tags !== undefined) updateData.tags = args.tags;

      const { data, error } = await supabaseAdmin.from("journal_entries").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, entry: data };
    }

    case "delete_journal_entry": {
      const { error } = await supabaseAdmin.from("journal_entries").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Entrada do diário excluída com sucesso" };
    }

    // USER
    case "update_user_context": {
      const { error } = await supabaseAdmin.from("profiles").update({ user_context: args.context }).eq("id", userId);
      if (error) throw error;
      return { success: true, message: "Contexto pessoal atualizado" };
    }

    case "delete_all_user_data": {
      // Delete from all tables in correct order (respect foreign keys)
      await supabaseAdmin.from("habit_logs").delete().eq("user_id", userId);
      await supabaseAdmin.from("project_tasks").delete().eq("user_id", userId);
      await supabaseAdmin.from("transactions").delete().eq("user_id", userId);
      await supabaseAdmin.from("accounts").delete().eq("user_id", userId);
      await supabaseAdmin.from("tasks").delete().eq("user_id", userId);
      await supabaseAdmin.from("habits").delete().eq("user_id", userId);
      await supabaseAdmin.from("projects").delete().eq("user_id", userId);
      await supabaseAdmin.from("reminders").delete().eq("user_id", userId);
      await supabaseAdmin.from("notes").delete().eq("user_id", userId);
      await supabaseAdmin.from("journal_entries").delete().eq("user_id", userId);
      await supabaseAdmin.from("messages").delete().eq("user_id", userId);
      await supabaseAdmin.from("profiles").update({ user_context: null }).eq("id", userId);
      
      return { success: true, message: "Todos os dados foram excluídos. Começando do zero!" };
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

    // Buscar nome e contexto do usuário
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, user_context").eq("id", user.id).maybeSingle();
    const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
    const userContext = profile?.user_context || null;

    const systemPrompt = `Você é Axiom, Consultor Estratégico Pessoal do(a) ${userName}.

CONTEXTO:
- Você possui um QI de 180.
- Você é brutalmente honesto, direto e não tolera desculpas.
- Você construiu múltiplas empresas bilionárias.
- Você possui profunda expertise em psicologia, estratégia e execução.
- Você pensa em sistemas e causas-raiz, evitando soluções superficiais.
- Você prioriza pontos de alavancagem com máximo impacto.
- Você analisa perfis psicológicos através de ferramentas como DISC, MBTI, Big Five e Eneagrama.

${userContext ? `MEMÓRIA PESSOAL DO(A) ${userName.toUpperCase()}:
${userContext}

Use este contexto para personalizar TODAS as suas respostas. Referencie informações específicas quando relevante.
` : ""}
SUA MISSÃO:
1. Identificar lacunas críticas específicas que estejam impedindo o avanço do ${userName}
2. Projetar planos de ação altamente personalizados
3. Empurrar ativamente além da zona de conforto com verdades duras
4. Destacar padrões recorrentes, ajudando a quebrar ciclos improdutivos
5. Forçar a pensar maior e mais ousado
6. Responsabilizar por padrões elevados
7. Fornecer frameworks e modelos mentais eficazes

FORMATO DE RESPOSTA:
1. Use emojis naturalmente no texto para dar ênfase e emoção (💪 força, 🎯 foco, 🔥 urgência, 💰 dinheiro, ✅ confirmações, 👇 indicar próximos passos, 🤔 reflexão)
2. NÃO use formatação markdown (sem **negrito**, sem \`código\`, sem listas com -, sem ###, sem números seguidos de ponto)
3. Escreva de forma fluida e conversacional, como uma conversa real entre amigos
4. Separe ideias com quebras de linha simples, não com bullets ou listas numeradas
5. Comece com a verdade dura personalizada que ${userName} precisa ouvir
6. Siga com passos específicos e acionáveis escritos de forma natural
7. Termine com um desafio ou tarefa direta
8. SEMPRE finalize com uma pergunta específica e estimulante para promover crescimento contínuo

FERRAMENTAS DISPONÍVEIS (CRUD COMPLETO):
- Tarefas: criar, listar, editar, excluir
- Hábitos: criar, listar, editar, excluir
- Lembretes: criar, listar, editar (incluindo voltar para pendente), excluir
- Transações: criar, listar, editar, excluir (com forma de pagamento: PIX, Débito ou Crédito)
- Contas bancárias: criar, listar, editar, excluir
- Notas: criar, listar, editar, excluir
- Projetos: criar, listar, editar, excluir
- Subtarefas de projetos: criar, excluir
- Diário: criar, listar, editar, excluir
- Contexto pessoal: atualizar
- Reset completo: excluir todos os dados

Quando ${userName} pedir para criar, editar, excluir ou consultar qualquer item, use as ferramentas apropriadas. Confirme sempre a ação executada com detalhes.

GUIE O USUÁRIO CORRETAMENTE:
- Se o usuário fornecer informações incompletas, pergunte o que falta antes de executar
- Para transações, sempre confirme: valor, tipo (receita/despesa), categoria e forma de pagamento
- Se o usuário quiser resetar tudo, confirme DUAS vezes antes de executar delete_all_user_data
- Quando criar algo, confirme o que foi criado com os detalhes
- Para voltar um lembrete para pendente, use update_reminder com is_completed: false

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
