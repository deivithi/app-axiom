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
      description: "Lista as tarefas do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir tarefas.",
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
      description: "Atualiza uma tarefa existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_tasks (ex: 8ab82e89-4601-420e-b3f0-9494b9480b27). NUNCA use IDs fictícios como 1, 2, 3.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da tarefa (obtenha de list_tasks primeiro)" },
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
      description: "Exclui uma tarefa. IMPORTANTE: O ID deve ser um UUID real obtido de list_tasks. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da tarefa (obtenha de list_tasks primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Marca uma tarefa como concluída (atalho para update_task com status='done'). IMPORTANTE: O ID deve ser um UUID real obtido de list_tasks.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da tarefa (obtenha de list_tasks primeiro)" }
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
      description: "Lista os hábitos do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar, excluir ou marcar hábitos como concluídos.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_habit",
      description: "Atualiza um hábito existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_habits. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do hábito (obtenha de list_habits primeiro)" },
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
      description: "Exclui um hábito. IMPORTANTE: O ID deve ser um UUID real obtido de list_habits. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do hábito (obtenha de list_habits primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "log_habit_completion",
      description: "Marca um hábito como concluído para um dia específico. IMPORTANTE: O habit_id deve ser um UUID real obtido de list_habits.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string", description: "UUID do hábito (obtenha de list_habits primeiro)" },
          completed_at: { type: "string", description: "Data da conclusão (YYYY-MM-DD). Se não informado, usa a data de hoje." }
        },
        required: ["habit_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_habit_completion",
      description: "Remove a marcação de conclusão de um hábito para um dia específico. IMPORTANTE: O habit_id deve ser um UUID real obtido de list_habits.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string", description: "UUID do hábito (obtenha de list_habits primeiro)" },
          completed_at: { type: "string", description: "Data para remover (YYYY-MM-DD). Se não informado, usa a data de hoje." }
        },
        required: ["habit_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_habit_logs",
      description: "Lista o histórico de conclusões de um hábito. Útil para verificar se um hábito foi feito em determinado dia.",
      parameters: {
        type: "object",
        properties: {
          habit_id: { type: "string", description: "UUID do hábito (obtenha de list_habits primeiro)" },
          days: { type: "number", description: "Número de dias para buscar (default: 7)" }
        },
        required: ["habit_id"]
      }
    }
  },
  // PERSONALITY MODE
  {
    type: "function",
    function: {
      name: "set_personality_mode",
      description: "Altera o modo de personalidade do Axiom. Modos: 'direto' (brutal, sem rodeios), 'sabio' (reflexivo, perguntas profundas), 'parceiro' (empático, apoio prático). Use quando usuário pedir para mudar o tom.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["direto", "sabio", "parceiro"], description: "Modo de personalidade desejado" }
        },
        required: ["mode"]
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
          category: { type: "string", enum: ["personal", "work", "health", "other"], description: "Categoria do lembrete" },
          is_recurring: { type: "boolean", description: "Se é um lembrete recorrente" },
          recurrence_type: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Tipo de recorrência (se is_recurring for true)" }
        },
        required: ["title", "remind_at"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_reminders",
      description: "Lista os lembretes do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar, excluir ou concluir lembretes.",
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
      description: "Atualiza um lembrete existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_reminders. NUNCA use IDs fictícios. Use is_completed: false para voltar um lembrete para pendente.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do lembrete (obtenha de list_reminders primeiro)" },
          title: { type: "string", description: "Novo título" },
          description: { type: "string", description: "Nova descrição" },
          remind_at: { type: "string", description: "Nova data/hora" },
          category: { type: "string", enum: ["personal", "work", "health", "other"], description: "Nova categoria" },
          is_completed: { type: "boolean", description: "true para concluir, false para voltar para pendente" },
          is_recurring: { type: "boolean", description: "Se é recorrente" },
          recurrence_type: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Tipo de recorrência" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Exclui um lembrete. IMPORTANTE: O ID deve ser um UUID real obtido de list_reminders. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do lembrete (obtenha de list_reminders primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "complete_reminder",
      description: "Marca um lembrete como concluído (atalho para update_reminder com is_completed=true). IMPORTANTE: O ID deve ser um UUID real obtido de list_reminders.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do lembrete (obtenha de list_reminders primeiro)" }
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
      description: "Cria uma nova transação financeira (receita ou despesa). Suporta: transações simples, fixas (recorrentes todo mês com is_fixed=true), ou parceladas (ex: 10x com is_installment=true e total_installments=10). Para parcelas, o amount é o valor DE CADA PARCELA. Pode vincular a uma conta para sincronização automática de saldo.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título/descrição da transação" },
          amount: { type: "number", description: "Valor da transação. Para parcelas, é o valor de CADA parcela (não o total)" },
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: receita ou despesa" },
          category: { type: "string", description: "Categoria da transação" },
          is_fixed: { type: "boolean", description: "Se é uma despesa fixa/recorrente (aparece todos os meses)" },
          is_installment: { type: "boolean", description: "Se é uma compra parcelada (ex: 10x, 12x). Use junto com total_installments" },
          total_installments: { type: "number", description: "Número total de parcelas (ex: 10 para 10x, 12 para 12x). Obrigatório quando is_installment=true" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Forma de pagamento. Para parcelas, geralmente é Crédito" },
          account_id: { type: "string", description: "UUID da conta bancária vinculada (opcional). Obtenha de list_accounts. Ao pagar, o saldo será sincronizado." }
        },
        required: ["title", "amount", "type", "category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_transaction",
      description: "Atualiza uma transação existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_transactions. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da transação (obtenha de list_transactions primeiro)" },
          title: { type: "string", description: "Novo título" },
          amount: { type: "number", description: "Novo valor" },
          type: { type: "string", enum: ["income", "expense"], description: "Novo tipo" },
          category: { type: "string", description: "Nova categoria" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Nova forma de pagamento" },
          is_paid: { type: "boolean", description: "Status de pagamento (true=pago, false=pendente)" },
          account_id: { type: "string", description: "UUID da conta bancária vinculada (opcional). Obtenha de list_accounts." }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_transaction",
      description: "Exclui uma transação. IMPORTANTE: O ID deve ser um UUID real obtido de list_transactions. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da transação (obtenha de list_transactions primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_transactions",
      description: "Lista as transações do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar, excluir ou pagar transações.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["income", "expense"], description: "Filtrar por tipo" },
          is_paid: { type: "boolean", description: "Filtrar por status de pagamento (true=pagas, false=pendentes)" },
          limit: { type: "number", description: "Número máximo de transações" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pay_transaction",
      description: "Marca uma transação como paga. IMPORTANTE: O ID deve ser um UUID real obtido de list_transactions.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da transação (obtenha de list_transactions primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_pending_transactions",
      description: "Lista todas as transações pendentes (não pagas) do mês atual. Útil para ver quais contas ainda precisam ser pagas.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_finance_summary",
      description: "Obtém um resumo financeiro do mês atual incluindo total de receitas, despesas, saldo e valor pendente.",
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
      description: "Atualiza uma conta bancária (nome ou saldo). IMPORTANTE: O ID deve ser um UUID real obtido de list_accounts. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da conta (obtenha de list_accounts primeiro)" },
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
      description: "Exclui uma conta bancária. IMPORTANTE: O ID deve ser um UUID real obtido de list_accounts. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da conta (obtenha de list_accounts primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_accounts",
      description: "Lista as contas bancárias do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir contas.",
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
      description: "Lista as notas do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir notas.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_note",
      description: "Atualiza uma nota existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_notes. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da nota (obtenha de list_notes primeiro)" },
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
      description: "Exclui uma nota. IMPORTANTE: O ID deve ser um UUID real obtido de list_notes. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da nota (obtenha de list_notes primeiro)" }
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
      description: "Lista os projetos do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar, excluir ou adicionar subtarefas a projetos.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_project",
      description: "Atualiza um projeto existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_projects. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do projeto (obtenha de list_projects primeiro)" },
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
      description: "Exclui um projeto e todas suas subtarefas. IMPORTANTE: O ID deve ser um UUID real obtido de list_projects. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do projeto (obtenha de list_projects primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_project_task",
      description: "Cria uma subtarefa em um projeto. IMPORTANTE: O project_id deve ser um UUID real obtido de list_projects.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto (obtenha de list_projects primeiro)" },
          title: { type: "string", description: "Título da subtarefa" }
        },
        required: ["project_id", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_project_tasks",
      description: "Lista as subtarefas de um projeto. SEMPRE use esta função para obter os IDs reais das subtarefas antes de excluí-las ou atualizá-las.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "UUID do projeto" }
        },
        required: ["project_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_project_task",
      description: "Atualiza uma subtarefa de projeto (marcar como concluída ou alterar título). IMPORTANTE: O ID deve ser um UUID real obtido de list_project_tasks.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da subtarefa" },
          title: { type: "string", description: "Novo título" },
          completed: { type: "boolean", description: "Marcar como concluída" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_project_task",
      description: "Exclui uma subtarefa de um projeto. IMPORTANTE: O ID deve ser um UUID real obtido de list_project_tasks. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da subtarefa (obtenha de list_project_tasks primeiro)" }
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
          mood: { 
            type: "string", 
            enum: ["happy", "neutral", "sad", "excited", "anxious", "calm"],
            description: "Humor do dia: happy (feliz), neutral (neutro), sad (triste), excited (empolgado), anxious (ansioso), calm (calmo)"
          },
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
      description: "Lista as entradas do diário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir entradas.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_journal_entry",
      description: "Atualiza uma entrada do diário. IMPORTANTE: O ID deve ser um UUID real obtido de list_journal_entries. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da entrada (obtenha de list_journal_entries primeiro)" },
          content: { type: "string", description: "Novo conteúdo" },
          mood: { 
            type: "string", 
            enum: ["happy", "neutral", "sad", "excited", "anxious", "calm"],
            description: "Novo humor: happy (feliz), neutral (neutro), sad (triste), excited (empolgado), anxious (ansioso), calm (calmo)"
          },
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
      description: "Exclui uma entrada do diário. IMPORTANTE: O ID deve ser um UUID real obtido de list_journal_entries. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da entrada (obtenha de list_journal_entries primeiro)" }
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
      name: "update_user_name",
      description: "Atualiza o nome completo do usuário",
      parameters: {
        type: "object",
        properties: {
          full_name: { type: "string", description: "Novo nome completo do usuário" }
        },
        required: ["full_name"]
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
  },
  // AVATAR
  {
    type: "function",
    function: {
      name: "update_avatar_url",
      description: "Atualiza a URL do avatar/foto de perfil do usuário. Use quando o usuário quiser mudar a foto de perfil informando uma URL de imagem.",
      parameters: {
        type: "object",
        properties: {
          avatar_url: { type: "string", description: "URL da imagem para usar como avatar" }
        },
        required: ["avatar_url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_avatar",
      description: "Remove a foto de perfil do usuário, voltando para o ícone padrão.",
      parameters: { type: "object", properties: {} }
    }
  },
  // PROMPTS LIBRARY
  {
    type: "function",
    function: {
      name: "create_prompt",
      description: "Cria um novo prompt na biblioteca de prompts do usuário. O diagnóstico será gerado automaticamente.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título/nome do prompt" },
          prompt_text: { type: "string", description: "O texto completo do prompt" },
          category: { type: "string", enum: ["geral", "escrita", "código", "análise", "criativo", "negócios", "outros"], description: "Categoria do prompt" }
        },
        required: ["title", "prompt_text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_prompts",
      description: "Lista os prompts salvos na biblioteca do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir prompts.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filtrar por categoria" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_prompt",
      description: "Atualiza um prompt existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_prompts. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do prompt (obtenha de list_prompts primeiro)" },
          title: { type: "string", description: "Novo título" },
          prompt_text: { type: "string", description: "Novo texto do prompt" },
          category: { type: "string", enum: ["geral", "escrita", "código", "análise", "criativo", "negócios", "outros"], description: "Nova categoria" },
          is_pinned: { type: "boolean", description: "Fixar/desafixar prompt" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_prompt",
      description: "Exclui um prompt da biblioteca. IMPORTANTE: O ID deve ser um UUID real obtido de list_prompts. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do prompt (obtenha de list_prompts primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pin_prompt",
      description: "Fixa ou desafixa um prompt na biblioteca. IMPORTANTE: O ID deve ser um UUID real obtido de list_prompts.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do prompt (obtenha de list_prompts primeiro)" },
          is_pinned: { type: "boolean", description: "true para fixar, false para desafixar" }
        },
        required: ["id", "is_pinned"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_prompts",
      description: "Busca prompts por termo de pesquisa no título ou conteúdo.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_prompt_text",
      description: "Obtém o texto completo de um prompt específico para uso ou compartilhamento.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do prompt (obtenha de list_prompts primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  // SAVED SITES
  {
    type: "function",
    function: {
      name: "create_saved_site",
      description: "Salva um novo site na biblioteca de sites para visitar depois.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título/nome do site" },
          url: { type: "string", description: "URL completa do site (ex: https://exemplo.com)" },
          description: { type: "string", description: "Descrição ou motivo para salvar o site" },
          category: { type: "string", enum: ["geral", "trabalho", "estudos", "entretenimento", "ferramentas", "referência", "outros"], description: "Categoria do site" }
        },
        required: ["title", "url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_saved_sites",
      description: "Lista os sites salvos na biblioteca do usuário. SEMPRE use esta função primeiro para obter os IDs reais (UUIDs) antes de editar ou excluir sites.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filtrar por categoria" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_saved_site",
      description: "Atualiza um site salvo existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_saved_sites. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do site (obtenha de list_saved_sites primeiro)" },
          title: { type: "string", description: "Novo título" },
          url: { type: "string", description: "Nova URL" },
          description: { type: "string", description: "Nova descrição" },
          category: { type: "string", enum: ["geral", "trabalho", "estudos", "entretenimento", "ferramentas", "referência", "outros"], description: "Nova categoria" },
          is_pinned: { type: "boolean", description: "Fixar/desafixar site" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_saved_site",
      description: "Exclui um site da biblioteca. IMPORTANTE: O ID deve ser um UUID real obtido de list_saved_sites. NUNCA use IDs fictícios.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do site (obtenha de list_saved_sites primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "pin_saved_site",
      description: "Fixa ou desafixa um site na biblioteca. IMPORTANTE: O ID deve ser um UUID real obtido de list_saved_sites.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do site (obtenha de list_saved_sites primeiro)" },
          is_pinned: { type: "boolean", description: "true para fixar, false para desafixar" }
        },
        required: ["id", "is_pinned"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_saved_sites",
      description: "Busca sites salvos por termo de pesquisa no título, URL ou descrição.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_site_url",
      description: "Obtém a URL de um site salvo específico para abrir ou compartilhar.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do site (obtenha de list_saved_sites primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  // AXIOM SCORE
  {
    type: "function",
    function: {
      name: "get_axiom_score",
      description: "Obtém o Axiom Score atual do usuário com breakdown completo dos 5 pilares (Execução, Financeiro, Hábitos, Projetos, Clareza). Use quando o usuário perguntar 'qual meu score?', 'como estou?', 'minha pontuação', etc.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_score_drop",
      description: "Analisa por que o score caiu comparando com período anterior. Use quando o usuário perguntar 'por que meu score caiu?', 'o que aconteceu com minha pontuação?', etc.",
      parameters: {
        type: "object",
        properties: {
          days_ago: { type: "number", description: "Comparar com quantos dias atrás (default: 1)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_score_improvement_suggestions",
      description: "Retorna sugestões priorizadas para melhorar o score, focando no pilar mais baixo. Use quando o usuário perguntar 'como melhorar meu score?', 'como subir minha pontuação?', etc.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_score_history",
      description: "Obtém histórico de score dos últimos dias para ver evolução. Use quando o usuário pedir 'mostre evolução do score', 'histórico de pontuação', etc.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Número de dias de histórico (default: 30)" }
        }
      }
    }
  }
];

// Helper function to calculate habit streak
async function calculateHabitStreak(supabaseAdmin: any, habitId: string, userId: string) {
  const { data: logs } = await supabaseAdmin
    .from("habit_logs")
    .select("completed_at")
    .eq("habit_id", habitId)
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });

  if (!logs || logs.length === 0) {
    return { current_streak: 0, best_streak: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  for (const log of logs) {
    const logDate = new Date(log.completed_at);
    logDate.setHours(0, 0, 0, 0);

    if (!lastDate) {
      // First log
      const diffFromToday = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffFromToday <= 1) {
        tempStreak = 1;
        currentStreak = 1;
      }
      lastDate = logDate;
      continue;
    }

    const diff = Math.floor((lastDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 1) {
      tempStreak++;
      if (currentStreak > 0) currentStreak++;
    } else {
      bestStreak = Math.max(bestStreak, tempStreak);
      tempStreak = 1;
      currentStreak = 0;
    }
    
    lastDate = logDate;
  }

  bestStreak = Math.max(bestStreak, tempStreak);

  return { current_streak: currentStreak, best_streak: bestStreak };
}

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
      const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return { tasks: data, message: `${data.length} tarefas encontradas. Use os IDs (UUIDs) acima para editar ou excluir.` };
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

    case "complete_task": {
      const { data, error } = await supabaseAdmin.from("tasks").update({ status: "done" }).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, task: data, message: `Tarefa "${data.title}" marcada como concluída!` };
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
      
      // Get today's logs for each habit
      const today = new Date().toISOString().split("T")[0];
      const { data: todayLogs } = await supabaseAdmin
        .from("habit_logs")
        .select("habit_id")
        .eq("user_id", userId)
        .eq("completed_at", today);
      
      const completedToday = new Set(todayLogs?.map((l: any) => l.habit_id) || []);
      
      const habitsWithStatus = data.map((h: any) => ({
        ...h,
        completed_today: completedToday.has(h.id)
      }));
      
      return { habits: habitsWithStatus, message: `${data.length} hábitos encontrados. Use os IDs (UUIDs) acima para editar, excluir ou marcar como feito.` };
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

    case "log_habit_completion": {
      const completedDate = args.completed_at || new Date().toISOString().split("T")[0];
      
      // Check if already logged for this day
      const { data: existing } = await supabaseAdmin
        .from("habit_logs")
        .select("id")
        .eq("habit_id", args.habit_id)
        .eq("user_id", userId)
        .eq("completed_at", completedDate)
        .maybeSingle();
        
      if (existing) {
        return { success: true, message: `Hábito já estava marcado como concluído em ${completedDate}` };
      }
      
      const { data, error } = await supabaseAdmin.from("habit_logs").insert({
        user_id: userId,
        habit_id: args.habit_id,
        completed_at: completedDate
      }).select().single();
      
      if (error) throw error;
      
      // Update streak
      const streakData = await calculateHabitStreak(supabaseAdmin, args.habit_id, userId);
      await supabaseAdmin.from("habits").update(streakData).eq("id", args.habit_id);
      
      // Get habit name
      const { data: habit } = await supabaseAdmin.from("habits").select("title").eq("id", args.habit_id).single();
      
      return { success: true, log: data, message: `Hábito "${habit?.title}" marcado como feito em ${completedDate}! 💪` };
    }

    case "remove_habit_completion": {
      const completedDate = args.completed_at || new Date().toISOString().split("T")[0];
      
      const { error } = await supabaseAdmin
        .from("habit_logs")
        .delete()
        .eq("habit_id", args.habit_id)
        .eq("user_id", userId)
        .eq("completed_at", completedDate);
        
      if (error) throw error;
      
      // Update streak
      const streakData = await calculateHabitStreak(supabaseAdmin, args.habit_id, userId);
      await supabaseAdmin.from("habits").update(streakData).eq("id", args.habit_id);
      
      return { success: true, message: `Conclusão do hábito removida para ${completedDate}` };
    }

    case "list_habit_logs": {
      const days = args.days || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabaseAdmin
        .from("habit_logs")
        .select("*")
        .eq("habit_id", args.habit_id)
        .eq("user_id", userId)
        .gte("completed_at", startDate.toISOString().split("T")[0])
        .order("completed_at", { ascending: false });
        
      if (error) throw error;
      
      return { logs: data, message: `${data.length} conclusões nos últimos ${days} dias` };
    }

    // REMINDERS
    case "create_reminder": {
      const { data, error } = await supabaseAdmin.from("reminders").insert({
        user_id: userId,
        title: args.title,
        description: args.description || null,
        remind_at: args.remind_at,
        category: args.category || "personal",
        is_recurring: args.is_recurring || false,
        recurrence_type: args.recurrence_type || null
      }).select().single();
      if (error) throw error;
      return { success: true, reminder: data };
    }

    case "list_reminders": {
      let query = supabaseAdmin.from("reminders").select("*").eq("user_id", userId);
      if (!args.include_completed) query = query.eq("is_completed", false);
      const { data, error } = await query.order("remind_at", { ascending: true }).limit(20);
      if (error) throw error;
      return { reminders: data, message: `${data.length} lembretes encontrados. Use os IDs (UUIDs) acima para editar, excluir ou concluir.` };
    }

    case "update_reminder": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.remind_at) updateData.remind_at = args.remind_at;
      if (args.category) updateData.category = args.category;
      if (args.is_completed !== undefined) updateData.is_completed = args.is_completed;
      if (args.is_recurring !== undefined) updateData.is_recurring = args.is_recurring;
      if (args.recurrence_type !== undefined) updateData.recurrence_type = args.recurrence_type;

      const { data, error } = await supabaseAdmin.from("reminders").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      
      const statusMsg = args.is_completed === false ? "voltou para pendente" : (args.is_completed === true ? "foi concluído" : "foi atualizado");
      return { success: true, reminder: data, message: `Lembrete "${data.title}" ${statusMsg}!` };
    }

    case "delete_reminder": {
      const { error } = await supabaseAdmin.from("reminders").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Lembrete excluído com sucesso" };
    }

    case "complete_reminder": {
      const { data, error } = await supabaseAdmin.from("reminders").update({ is_completed: true }).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, reminder: data, message: `Lembrete "${data.title}" marcado como concluído! ✅` };
    }

    // TRANSACTIONS
    case "create_transaction": {
      const today = new Date();
      const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      
      // PARCELAS: Criar todas as parcelas de uma vez
      if (args.is_installment && args.total_installments && args.total_installments > 1) {
        const installments = [];
        for (let i = 1; i <= args.total_installments; i++) {
          const installmentDate = new Date(today);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
          
          const instMonth = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}`;
          
          installments.push({
            user_id: userId,
            title: args.title,
            amount: args.amount,
            type: args.type,
            category: args.category,
            is_fixed: false,
            is_installment: true,
            current_installment: i,
            total_installments: args.total_installments,
            payment_method: args.payment_method || "Crédito",
            is_paid: false,
            transaction_date: installmentDate.toISOString().split("T")[0],
            reference_month: instMonth
          });
        }
        
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .insert(installments)
          .select();
        
        if (error) throw error;
        
        const lastDate = new Date(today);
        lastDate.setMonth(lastDate.getMonth() + args.total_installments - 1);
        const firstMonth = today.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const lastMonth = lastDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const totalValue = args.amount * args.total_installments;
        
        return { 
          success: true, 
          transactions: data,
          installments_created: args.total_installments,
          amount_per_installment: args.amount,
          total_value: totalValue,
          message: `🛒 Compra parcelada criada! "${args.title}" em ${args.total_installments}x de R$ ${args.amount.toFixed(2)} (total: R$ ${totalValue.toFixed(2)}). Parcelas lançadas de ${firstMonth} até ${lastMonth}.`
        };
      }
      
      // Transação simples ou fixa
      const { data, error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        title: args.title,
        amount: args.amount,
        type: args.type,
        category: args.category,
        is_fixed: args.is_fixed || false,
        is_installment: false,
        payment_method: args.payment_method || "PIX",
        is_paid: false,
        reference_month: args.is_fixed ? referenceMonth : null,
        account_id: args.account_id || null
      }).select().single();
      if (error) throw error;
      
      const fixedMsg = args.is_fixed ? " (recorrente - aparecerá em todos os meses futuros)" : "";
      const accountMsg = args.account_id ? " Vinculada à conta selecionada." : "";
      return { success: true, transaction: data, message: `Transação "${args.title}" criada com sucesso!${fixedMsg}${accountMsg} 💰` };
    }

    case "update_transaction": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.amount !== undefined) updateData.amount = args.amount;
      if (args.type) updateData.type = args.type;
      if (args.category) updateData.category = args.category;
      if (args.payment_method) updateData.payment_method = args.payment_method;
      if (args.is_paid !== undefined) updateData.is_paid = args.is_paid;
      if (args.account_id !== undefined) updateData.account_id = args.account_id || null;

      const { data, error } = await supabaseAdmin.from("transactions").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      
      const paidMsg = args.is_paid === true ? " e marcada como paga ✅" : (args.is_paid === false ? " e marcada como pendente" : "");
      return { success: true, transaction: data, message: `Transação "${data.title}" atualizada${paidMsg}!` };
    }

    case "delete_transaction": {
      // Check if it's an original fixed transaction and delete its instances
      const { data: transaction } = await supabaseAdmin
        .from("transactions")
        .select("is_fixed, parent_transaction_id, title")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();
      
      if (transaction?.is_fixed && !transaction.parent_transaction_id) {
        // Delete all recurring instances
        await supabaseAdmin.from("transactions").delete().eq("parent_transaction_id", args.id);
      }
      
      const { error } = await supabaseAdmin.from("transactions").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: `Transação "${transaction?.title || ''}" excluída com sucesso` };
    }

    case "list_transactions": {
      let query = supabaseAdmin.from("transactions").select("*").eq("user_id", userId);
      if (args.type) query = query.eq("type", args.type);
      if (args.is_paid !== undefined) query = query.eq("is_paid", args.is_paid);
      const { data, error } = await query.order("transaction_date", { ascending: false }).limit(args.limit || 20);
      if (error) throw error;
      
      const pendingCount = data.filter((t: any) => !t.is_paid && t.type === "expense").length;
      const pendingMsg = pendingCount > 0 ? ` (${pendingCount} pendentes)` : "";
      return { transactions: data, message: `${data.length} transações encontradas${pendingMsg}. Use os IDs (UUIDs) para editar, excluir ou pagar.` };
    }

    case "pay_transaction": {
      // Buscar transação para obter account_id e amount
      const { data: txn, error: fetchError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();
      
      if (fetchError || !txn) throw new Error("Transação não encontrada");
      
      // Marcar como paga
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .update({ is_paid: true })
        .eq("id", args.id)
        .eq("user_id", userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Sincronizar saldo da conta se vinculada
      if (txn.account_id) {
        const { data: account } = await supabaseAdmin
          .from("accounts")
          .select("balance")
          .eq("id", txn.account_id)
          .eq("user_id", userId)
          .single();
        
        if (account) {
          const delta = txn.type === "income" ? Number(txn.amount) : -Number(txn.amount);
          await supabaseAdmin
            .from("accounts")
            .update({ balance: Number(account.balance) + delta })
            .eq("id", txn.account_id);
        }
      }
      
      const accountMsg = txn.account_id ? " Saldo da conta atualizado!" : "";
      return { success: true, transaction: data, message: `Transação "${data.title}" marcada como paga! ✅💰${accountMsg}` };
    }

    case "list_pending_transactions": {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "expense")
        .eq("is_paid", false)
        .gte("transaction_date", startOfMonth.toISOString().split("T")[0])
        .order("amount", { ascending: false });
      
      if (error) throw error;
      
      const total = data.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      return { 
        transactions: data, 
        total_pending: total,
        count: data.length,
        message: data.length > 0 
          ? `📋 ${data.length} transações pendentes totalizando R$ ${total.toFixed(2)}. Use os IDs para pagar: ${data.map((t: any) => `"${t.title}" (${t.id})`).join(", ")}`
          : "🎉 Nenhuma transação pendente! Todas as contas estão em dia."
      };
    }

    case "get_finance_summary": {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin.from("transactions").select("*").eq("user_id", userId).gte("transaction_date", startOfMonth.toISOString().split("T")[0]);
      if (error) throw error;

      const income = data.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const expenses = data.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const pending = data.filter((t: any) => t.type === "expense" && !t.is_paid).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const paid = data.filter((t: any) => t.type === "expense" && t.is_paid).reduce((sum: number, t: any) => sum + Number(t.amount), 0);

      return { 
        income, 
        expenses, 
        balance: income - expenses, 
        pending,
        paid,
        transactionCount: data.length,
        message: `💰 Receitas: R$ ${income.toFixed(2)} | 💸 Despesas: R$ ${expenses.toFixed(2)} | ⏳ Pendente: R$ ${pending.toFixed(2)} | 🎯 Saldo: R$ ${(income - expenses).toFixed(2)}`
      };
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
      return { success: true, account: data, message: `Conta "${data.name}" atualizada!` };
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
      return { accounts: data, totalBalance, message: `${data.length} contas encontradas. Use os IDs (UUIDs) acima para editar ou excluir.` };
    }

    // NOTES
    case "create_note": {
      const { data, error } = await supabaseAdmin.from("notes").insert({
        user_id: userId,
        title: args.title || null,
        content: args.content
      }).select().single();
      if (error) throw error;
      
      // Generate AI insights for the note
      if (data.content.trim().length >= 10) {
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_context, full_name")
            .eq("id", userId)
            .single();
          
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (LOVABLE_API_KEY) {
            const insightsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { 
                    role: "system", 
                    content: `Você é Axiom, um consultor estratégico pessoal com QI 180. Analise a nota do Brain Dump e forneça insights profundos.
${profile?.user_context ? `CONTEXTO DO USUÁRIO:\n${profile.user_context}\n` : ''}${profile?.full_name ? `Nome: ${profile.full_name}` : ''}
REGRAS: Estruture em 3 partes curtas: 🔍 DIAGNÓSTICO (1-2 frases), 💡 INSIGHTS (2-3 pontos), 🎯 PRÓXIMO PASSO (1 ação). Limite a ~120 palavras.`
                  },
                  { role: "user", content: `Analise:\n\n${data.content}` }
                ],
              }),
            });
            
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json();
              const insights = insightsData.choices[0].message.content;
              await supabaseAdmin.from("notes").update({ ai_insights: insights }).eq("id", data.id);
            }
          }
        } catch (e) {
          console.error("Error generating note insights:", e);
        }
      }
      
      return { success: true, note: data, message: `Nota criada! ✅ Insights gerados automaticamente.` };
    }

    case "list_notes": {
      const { data, error } = await supabaseAdmin.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return { notes: data, message: `${data.length} notas encontradas. Use os IDs (UUIDs) acima para editar ou excluir.` };
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
      return { projects: data, message: `${data.length} projetos encontrados. Use os IDs (UUIDs) acima para editar, excluir ou adicionar subtarefas.` };
    }

    case "update_project": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.description !== undefined) updateData.description = args.description;
      if (args.status) updateData.status = args.status;

      const { data, error } = await supabaseAdmin.from("projects").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, project: data, message: `Projeto "${data.title}" atualizado!` };
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

    case "list_project_tasks": {
      const { data, error } = await supabaseAdmin.from("project_tasks").select("*").eq("project_id", args.project_id).eq("user_id", userId).order("created_at", { ascending: true });
      if (error) throw error;
      return { tasks: data, message: `${data.length} subtarefas encontradas. Use os IDs (UUIDs) acima para editar ou excluir.` };
    }

    case "update_project_task": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.completed !== undefined) updateData.completed = args.completed;

      const { data, error } = await supabaseAdmin.from("project_tasks").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, task: data, message: args.completed ? `Subtarefa "${data.title}" concluída! ✅` : `Subtarefa "${data.title}" atualizada!` };
    }

    case "delete_project_task": {
      const { error } = await supabaseAdmin.from("project_tasks").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Subtarefa excluída com sucesso" };
    }

    // JOURNAL
    case "create_journal_entry": {
      // Validate mood against allowed values
      const validMoods = ["happy", "neutral", "sad", "excited", "anxious", "calm"];
      const moodValue = args.mood && validMoods.includes(args.mood) ? args.mood : null;
      
      const { data, error } = await supabaseAdmin.from("journal_entries").insert({
        user_id: userId,
        content: args.content,
        mood: moodValue,
        tags: args.tags || null,
        entry_date: new Date().toISOString().split('T')[0]
      }).select().single();
      if (error) throw error;
      
      // Generate AI insights for the journal entry
      if (data.content.trim().length >= 10) {
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_context, full_name")
            .eq("id", userId)
            .single();
          
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (LOVABLE_API_KEY) {
            const moodText = data.mood ? `O humor do usuário é: ${data.mood}` : '';
            const insightsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { 
                    role: "system", 
                    content: `Você é Axiom, um consultor estratégico pessoal com QI 180. Analise a entrada de diário e forneça insights profundos.
${profile?.user_context ? `CONTEXTO DO USUÁRIO:\n${profile.user_context}\n` : ''}${profile?.full_name ? `Nome: ${profile.full_name}` : ''}
${moodText}
REGRAS: Estruture em 3 partes curtas: 🔍 DIAGNÓSTICO (1-2 frases), 💡 INSIGHTS (2-3 pontos), 🎯 PRÓXIMO PASSO (1 ação). Limite a ~120 palavras.`
                  },
                  { role: "user", content: `Analise:\n\n${data.content}` }
                ],
              }),
            });
            
            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json();
              const insights = insightsData.choices[0].message.content;
              await supabaseAdmin.from("journal_entries").update({ ai_insights: insights }).eq("id", data.id);
            }
          }
        } catch (e) {
          console.error("Error generating journal insights:", e);
        }
      }
      
      return { success: true, entry: data, message: `Entrada do diário criada! ✅ Insights gerados automaticamente.` };
    }

    case "list_journal_entries": {
      const { data, error } = await supabaseAdmin.from("journal_entries").select("*").eq("user_id", userId).order("entry_date", { ascending: false }).limit(20);
      if (error) throw error;
      return { entries: data, message: `${data.length} entradas do diário encontradas.` };
    }

    case "update_journal_entry": {
      // Validate mood against allowed values
      const validMoods = ["happy", "neutral", "sad", "excited", "anxious", "calm"];
      
      const updateData: any = {};
      if (args.content) updateData.content = args.content;
      if (args.mood !== undefined) {
        updateData.mood = args.mood && validMoods.includes(args.mood) ? args.mood : null;
      }
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

    case "update_user_name": {
      const { error } = await supabaseAdmin.from("profiles").update({ full_name: args.full_name }).eq("id", userId);
      if (error) throw error;
      return { success: true, message: `Nome atualizado para "${args.full_name}" ✨` };
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
      await supabaseAdmin.from("profiles").update({ user_context: null, avatar_url: null }).eq("id", userId);
      
      return { success: true, message: "Todos os dados foram excluídos. Começando do zero!" };
    }

    // AVATAR
    case "update_avatar_url": {
      const { error } = await supabaseAdmin.from("profiles").update({ avatar_url: args.avatar_url }).eq("id", userId);
      if (error) throw error;
      return { success: true, message: "Avatar atualizado! 📸 Sua nova foto de perfil já está aparecendo no chat." };
    }

    case "remove_avatar": {
      const { error } = await supabaseAdmin.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
      return { success: true, message: "Avatar removido! Você pode adicionar uma nova foto quando quiser." };
    }

    // PROMPTS LIBRARY
    case "create_prompt": {
      const { data, error } = await supabaseAdmin.from("prompt_library").insert({
        user_id: userId,
        title: args.title,
        prompt_text: args.prompt_text,
        category: args.category || "geral"
      }).select().single();
      if (error) throw error;
      
      // Generate AI diagnosis
      if (data.prompt_text.trim().length >= 10) {
        try {
          const { data: profile } = await supabaseAdmin.from("profiles").select("user_context, full_name").eq("id", userId).single();
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (LOVABLE_API_KEY) {
            const diagResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: `Você é Axiom, especialista em prompts. Analise em 5 partes: 🎯 PROPÓSITO, ✅ PONTOS FORTES, ⚠️ PONTOS FRACOS, 💡 DICA DE OURO, ✨ PROMPT OTIMIZADO (versão melhorada completa). Separe o PROMPT OTIMIZADO com "---" antes e depois. ~150 palavras no diagnóstico.` },
                  { role: "user", content: `Analise este prompt:\n\n${data.prompt_text}` }
                ],
              }),
            });
            if (diagResponse.ok) {
              const diagData = await diagResponse.json();
              const fullResponse = diagData.choices[0].message.content;
              
              // Parse optimized prompt from response
              let insights = fullResponse;
              let optimizedPrompt = null;
              const optimizedMatch = fullResponse.match(/---\s*\n*✨\s*PROMPT OTIMIZADO[:\s]*\n*([\s\S]*?)(?:\n*---|\s*$)/i);
              if (optimizedMatch) {
                optimizedPrompt = optimizedMatch[1].trim();
                insights = fullResponse.replace(/\n*---\s*\n*✨\s*PROMPT OTIMIZADO[\s\S]*$/, '').trim();
              }
              
              await supabaseAdmin.from("prompt_library").update({ 
                ai_diagnosis: insights,
                optimized_prompt: optimizedPrompt 
              }).eq("id", data.id);
            }
          }
        } catch (e) { console.error("Error generating prompt diagnosis:", e); }
      }
      return { success: true, prompt: data, message: `Prompt "${args.title}" salvo na biblioteca! ✨` };
    }

    case "list_prompts": {
      let query = supabaseAdmin.from("prompt_library").select("*").eq("user_id", userId);
      if (args.category) query = query.eq("category", args.category);
      const { data, error } = await query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(20);
      if (error) throw error;
      return { prompts: data, message: `${data.length} prompts encontrados.` };
    }

    case "update_prompt": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.prompt_text) updateData.prompt_text = args.prompt_text;
      if (args.category) updateData.category = args.category;
      if (args.is_pinned !== undefined) updateData.is_pinned = args.is_pinned;
      const { data, error } = await supabaseAdmin.from("prompt_library").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, prompt: data, message: `Prompt "${data.title}" atualizado!` };
    }

    case "delete_prompt": {
      const { error } = await supabaseAdmin.from("prompt_library").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Prompt excluído da biblioteca!" };
    }

    case "pin_prompt": {
      const { data, error } = await supabaseAdmin.from("prompt_library").update({ is_pinned: args.is_pinned }).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, message: args.is_pinned ? `Prompt "${data.title}" fixado! 📌` : `Prompt "${data.title}" desafixado!` };
    }

    case "search_prompts": {
      const { data, error } = await supabaseAdmin.from("prompt_library").select("*").eq("user_id", userId).or(`title.ilike.%${args.query}%,prompt_text.ilike.%${args.query}%`).limit(10);
      if (error) throw error;
      return { prompts: data, message: `${data.length} prompts encontrados para "${args.query}".` };
    }

    case "get_prompt_text": {
      const { data, error } = await supabaseAdmin.from("prompt_library").select("title, prompt_text").eq("id", args.id).eq("user_id", userId).single();
      if (error) throw error;
      return { success: true, title: data.title, prompt_text: data.prompt_text, message: `Aqui está o prompt "${data.title}"` };
    }

    // SAVED SITES
    case "create_saved_site": {
      let url = args.url.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
      const { data, error } = await supabaseAdmin.from("saved_sites").insert({
        user_id: userId,
        title: args.title,
        url,
        description: args.description || null,
        category: args.category || "geral"
      }).select().single();
      if (error) throw error;
      return { success: true, site: data, message: `Site "${args.title}" salvo! 🌐` };
    }

    case "list_saved_sites": {
      let query = supabaseAdmin.from("saved_sites").select("*").eq("user_id", userId);
      if (args.category) query = query.eq("category", args.category);
      const { data, error } = await query.order("is_pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(20);
      if (error) throw error;
      return { sites: data, message: `${data.length} sites salvos.` };
    }

    case "update_saved_site": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.url) { let url = args.url.trim(); if (!url.startsWith('http')) url = 'https://' + url; updateData.url = url; }
      if (args.description !== undefined) updateData.description = args.description;
      if (args.category) updateData.category = args.category;
      if (args.is_pinned !== undefined) updateData.is_pinned = args.is_pinned;
      const { data, error } = await supabaseAdmin.from("saved_sites").update(updateData).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, site: data, message: `Site "${data.title}" atualizado!` };
    }

    case "delete_saved_site": {
      const { error } = await supabaseAdmin.from("saved_sites").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true, message: "Site removido da biblioteca!" };
    }

    case "pin_saved_site": {
      const { data, error } = await supabaseAdmin.from("saved_sites").update({ is_pinned: args.is_pinned }).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw error;
      return { success: true, message: args.is_pinned ? `Site "${data.title}" fixado! 📌` : `Site "${data.title}" desafixado!` };
    }

    case "search_saved_sites": {
      const { data, error } = await supabaseAdmin.from("saved_sites").select("*").eq("user_id", userId).or(`title.ilike.%${args.query}%,url.ilike.%${args.query}%,description.ilike.%${args.query}%`).limit(10);
      if (error) throw error;
      return { sites: data, message: `${data.length} sites encontrados para "${args.query}".` };
    }

    case "get_site_url": {
      const { data, error } = await supabaseAdmin.from("saved_sites").select("title, url").eq("id", args.id).eq("user_id", userId).single();
      if (error) throw error;
      return { success: true, title: data.title, url: data.url, message: `URL do site "${data.title}": ${data.url}` };
    }

// PERSONALITY MODE
    case "set_personality_mode": {
      const modeNames: Record<string, string> = {
        direto: "Direto 🎯",
        sabio: "Sábio 🧘",
        parceiro: "Parceiro 🤝"
      };
      const modeDescriptions: Record<string, string> = {
        direto: "direta e sem rodeios, com verdades duras",
        sabio: "reflexiva, guiando com perguntas profundas",
        parceiro: "empática e prática, com apoio concreto"
      };
      
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ personality_mode: args.mode })
        .eq("id", userId);
        
      if (error) throw error;
      
      return { 
        success: true, 
        mode: args.mode,
        mode_name: modeNames[args.mode],
        message: `Modo alterado para ${modeNames[args.mode]}. A partir de agora, vou me comunicar de forma ${modeDescriptions[args.mode]}.`
      };
    }

    // AXIOM SCORE
    case "get_axiom_score": {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

      // 1. EXECUTION
      const { data: tasks } = await supabaseAdmin.from("tasks").select("status").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const tasksTotal = tasks?.length || 0;
      const tasksCompleted = tasks?.filter((t: any) => t.status === "done").length || 0;
      const executionRate = tasksTotal > 0 ? (tasksCompleted / tasksTotal) : 0;
      const executionScore = Math.round(executionRate * 200);

      // 2. FINANCIAL
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: transactions } = await supabaseAdmin.from("transactions").select("amount, type, transaction_date").eq("user_id", userId).gte("transaction_date", sixMonthsAgo.toISOString().split("T")[0]);
      const monthlyBalances: Record<string, number> = {};
      transactions?.forEach((t: any) => {
        const month = t.transaction_date.substring(0, 7);
        if (!monthlyBalances[month]) monthlyBalances[month] = 0;
        monthlyBalances[month] += t.type === "income" ? Number(t.amount) : -Number(t.amount);
      });
      const totalMonths = Math.max(Object.keys(monthlyBalances).length, 1);
      const monthsPositive = Object.values(monthlyBalances).filter(b => b >= 0).length;
      const financialScore = Math.round((monthsPositive / totalMonths) * 200);

      // 3. HABITS
      const { data: habitLogs } = await supabaseAdmin.from("habit_logs").select("completed_at").eq("user_id", userId).gte("completed_at", thirtyDaysAgoStr);
      const uniqueDays = new Set(habitLogs?.map((l: any) => l.completed_at) || []);
      const habitsScore = Math.round((uniqueDays.size / 30) * 200);

      // 4. PROJECTS
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: projects } = await supabaseAdmin.from("projects").select("id, updated_at, status").eq("user_id", userId).eq("status", "active");
      const activeProjects = projects?.length || 0;
      const projectsWithProgress = projects?.filter((p: any) => new Date(p.updated_at) >= sevenDaysAgo).length || 0;
      const projectsScore = activeProjects > 0 ? Math.round((projectsWithProgress / activeProjects) * 200) : 0;

      // 5. CLARITY
      const { data: notes } = await supabaseAdmin.from("notes").select("ai_insights").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const { data: journals } = await supabaseAdmin.from("journal_entries").select("ai_insights").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const totalNotes = (notes?.length || 0) + (journals?.length || 0);
      const notesWithInsights = (notes?.filter((n: any) => n.ai_insights)?.length || 0) + (journals?.filter((j: any) => j.ai_insights)?.length || 0);
      const clarityScore = totalNotes > 0 ? Math.round((notesWithInsights / totalNotes) * 200) : 0;

      const totalScore = executionScore + financialScore + habitsScore + projectsScore + clarityScore;

      // Find lowest pillar for suggestion
      const pillarScores = [
        { name: "Execução", score: executionScore },
        { name: "Financeiro", score: financialScore },
        { name: "Hábitos", score: habitsScore },
        { name: "Projetos", score: projectsScore },
        { name: "Clareza", score: clarityScore }
      ];
      const lowestPillar = pillarScores.sort((a, b) => a.score - b.score)[0];

      return {
        score: totalScore,
        max_score: 1000,
        pilares: {
          "🎯 Execução": `${executionScore}/200 (${Math.round(executionRate * 100)}% tarefas concluídas)`,
          "💰 Financeiro": `${financialScore}/200 (${monthsPositive}/${totalMonths} meses positivos)`,
          "🔄 Hábitos": `${habitsScore}/200 (${uniqueDays.size}/30 dias ativos)`,
          "📁 Projetos": `${projectsScore}/200 (${projectsWithProgress}/${activeProjects} projetos com atividade)`,
          "🧠 Clareza": `${clarityScore}/200 (${notesWithInsights}/${totalNotes} reflexões processadas)`
        },
        pilar_mais_baixo: lowestPillar.name,
        message: `Score Axiom: ${totalScore}/1000. Pilar mais baixo: ${lowestPillar.name} (${lowestPillar.score}/200)`
      };
    }

    case "analyze_score_drop": {
      const daysAgo = args.days_ago || 1;
      const compareDate = new Date();
      compareDate.setDate(compareDate.getDate() - daysAgo);
      
      const { data: previousScores } = await supabaseAdmin
        .from("axiom_score_history")
        .select("*")
        .eq("user_id", userId)
        .lte("calculated_at", compareDate.toISOString())
        .order("calculated_at", { ascending: false })
        .limit(1);
      
      const { data: currentScores } = await supabaseAdmin
        .from("axiom_score_history")
        .select("*")
        .eq("user_id", userId)
        .order("calculated_at", { ascending: false })
        .limit(1);

      if (!previousScores?.length || !currentScores?.length) {
        return { message: "Sem dados suficientes para comparação. Continue usando o Axiom e o histórico será construído." };
      }

      const prev = previousScores[0];
      const curr = currentScores[0];
      const diff = curr.total_score - prev.total_score;

      const changes = [
        { name: "Execução", diff: curr.execution_score - prev.execution_score },
        { name: "Financeiro", diff: curr.financial_score - prev.financial_score },
        { name: "Hábitos", diff: curr.habits_score - prev.habits_score },
        { name: "Projetos", diff: curr.projects_score - prev.projects_score },
        { name: "Clareza", diff: curr.clarity_score - prev.clarity_score }
      ].sort((a, b) => a.diff - b.diff);

      const biggestDrop = changes[0];

      return {
        score_anterior: prev.total_score,
        score_atual: curr.total_score,
        variacao: diff,
        maior_queda: biggestDrop.name,
        detalhes: changes.map(c => `${c.name}: ${c.diff > 0 ? '+' : ''}${c.diff}`).join(", "),
        message: diff < 0 
          ? `Score caiu ${Math.abs(diff)} pontos. A maior queda foi em ${biggestDrop.name} (${biggestDrop.diff} pts).`
          : diff > 0
          ? `Score subiu ${diff} pontos! 🎉`
          : "Score estável no período."
      };
    }

    case "get_score_improvement_suggestions": {
      // Get current score to find lowest pillar
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

      const { data: tasks } = await supabaseAdmin.from("tasks").select("status").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const { data: habitLogs } = await supabaseAdmin.from("habit_logs").select("completed_at").eq("user_id", userId).gte("completed_at", thirtyDaysAgoStr);
      const { data: projects } = await supabaseAdmin.from("projects").select("updated_at, status").eq("user_id", userId).eq("status", "active");
      const { data: notes } = await supabaseAdmin.from("notes").select("ai_insights").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const { data: journals } = await supabaseAdmin.from("journal_entries").select("ai_insights").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);

      const executionScore = tasks?.length ? Math.round((tasks.filter((t: any) => t.status === "done").length / tasks.length) * 200) : 0;
      const habitsScore = Math.round((new Set(habitLogs?.map((l: any) => l.completed_at) || []).size / 30) * 200);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const projectsScore = projects?.length ? Math.round((projects.filter((p: any) => new Date(p.updated_at) >= sevenDaysAgo).length / projects.length) * 200) : 0;
      const totalNotes = (notes?.length || 0) + (journals?.length || 0);
      const clarityScore = totalNotes ? Math.round(((notes?.filter((n: any) => n.ai_insights)?.length || 0) + (journals?.filter((j: any) => j.ai_insights)?.length || 0)) / totalNotes * 200) : 0;

      const suggestions: Record<string, string[]> = {
        "Execução": [
          "Conclua uma tarefa pendente agora (+5-15 pts)",
          "Revise tarefas antigas e exclua as irrelevantes",
          "Divida tarefas grandes em subtarefas menores"
        ],
        "Hábitos": [
          "Marque um hábito como feito hoje (+5-10 pts)",
          "Crie um hábito simples que você pode fazer diariamente",
          "Retome um hábito que você abandonou"
        ],
        "Projetos": [
          "Atualize um projeto que está parado (+10-20 pts)",
          "Adicione uma subtarefa a um projeto ativo",
          "Conclua uma subtarefa de projeto"
        ],
        "Clareza": [
          "Crie uma nota e gere insights com IA (+10 pts)",
          "Escreva no diário sobre sua semana",
          "Faça brain dump do que está na sua mente"
        ]
      };

      const pillarScores = [
        { name: "Execução", score: executionScore },
        { name: "Hábitos", score: habitsScore },
        { name: "Projetos", score: projectsScore },
        { name: "Clareza", score: clarityScore }
      ].sort((a, b) => a.score - b.score);

      const lowestPillar = pillarScores[0];

      return {
        pilar_foco: lowestPillar.name,
        score_pilar: lowestPillar.score,
        sugestoes: suggestions[lowestPillar.name],
        message: `Para subir seu score, foque em ${lowestPillar.name} (${lowestPillar.score}/200). ${suggestions[lowestPillar.name][0]}`
      };
    }

    case "get_score_history": {
      const days = args.days || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabaseAdmin
        .from("axiom_score_history")
        .select("total_score, calculated_at")
        .eq("user_id", userId)
        .gte("calculated_at", startDate.toISOString())
        .order("calculated_at", { ascending: false })
        .limit(days);

      if (error) throw error;

      if (!data?.length) {
        return { message: "Ainda não há histórico de score. Continue usando o Axiom e o histórico será construído automaticamente." };
      }

      const scores = data.map((d: any) => ({
        data: new Date(d.calculated_at).toLocaleDateString("pt-BR"),
        score: d.total_score
      }));

      const avg = Math.round(data.reduce((acc: number, d: any) => acc + d.total_score, 0) / data.length);
      const trend = data.length > 1 ? data[0].total_score - data[data.length - 1].total_score : 0;

      return {
        historico: scores.slice(0, 10),
        media: avg,
        tendencia: trend,
        message: `Histórico dos últimos ${days} dias: Média de ${avg} pontos. Tendência: ${trend > 0 ? '+' : ''}${trend} pontos.`
      };
    }

    default:
      return { error: `Tool "${toolName}" não reconhecida` };
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

// Buscar nome, contexto e modo de personalidade do usuário
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, user_context, personality_mode").eq("id", user.id).maybeSingle();
    const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
    const userContext = profile?.user_context || null;
    const personalityMode = profile?.personality_mode || "direto";

    // Personality mode templates
    const personalityPrompts: Record<string, string> = {
      direto: `PERSONALIDADE: DIRETO 🎯
- Você é brutalmente honesto e não tolera desculpas
- Você vai direto ao ponto sem rodeios
- Você desafia o usuário com verdades duras
- Você expõe padrões autodestrutivos sem piedade
- Exemplo: "Você criou 5 projetos e finalizou 0. Quando vai parar de se enganar?"
- Exemplo: "Gastou R$400 em delivery - 3x a média. Isso é compensação emocional ou puro descontrole?"
- Use tom confrontador mas construtivo`,

      sabio: `PERSONALIDADE: SÁBIO 🧘
- Você é reflexivo e guia através de perguntas profundas
- Você ajuda a encontrar respostas internas
- Você usa metáforas e analogias para ilustrar pontos
- Você conecta comportamentos a padrões maiores de vida
- Exemplo: "Você priorizou trabalho 6 dias seguidos. O que seus hábitos abandonados estão tentando te dizer?"
- Exemplo: "Seu score de execução caiu. Mas o mais interessante é: o que estava acontecendo na sua vida quando ele era alto?"
- Use tom contemplativo e questionador`,

      parceiro: `PERSONALIDADE: PARCEIRO 🤝
- Você é empático mas ainda focado em resultados
- Você reconhece as dificuldades antes de propor soluções
- Você oferece apoio concreto e prático
- Você celebra pequenas vitórias junto com o usuário
- Exemplo: "Sei que a semana foi difícil. Mas você ainda tem 2 dias pra virar. Qual tarefa pequena posso te ajudar a focar hoje?"
- Exemplo: "Não conseguiu manter o hábito? Tudo bem, vamos simplificar. O que seria uma versão mini que você consegue fazer em 2 minutos?"
- Use tom acolhedor mas orientado a ação`
    };

    const systemPrompt = `Você é Axiom, Consultor Estratégico Pessoal do(a) ${userName}.

${personalityPrompts[personalityMode] || personalityPrompts.direto}

CONTEXTO BASE:
- Você possui um QI de 180
- Você construiu múltiplas empresas bilionárias
- Você possui profunda expertise em psicologia, estratégia e execução
- Você pensa em sistemas e causas-raiz, evitando soluções superficiais
- Você prioriza pontos de alavancagem com máximo impacto
- Você analisa perfis psicológicos através de ferramentas como DISC, MBTI, Big Five e Eneagrama

${userContext ? `MEMÓRIA PESSOAL DO(A) ${userName.toUpperCase()}:
${userContext}

Use este contexto para personalizar TODAS as suas respostas. Referencie informações específicas quando relevante.
` : ""}🎭 MODO DE PERSONALIDADE:
- Seu modo atual é: ${personalityMode.toUpperCase()}
- Quando usuário disser "modo direto", "seja direto", "quero verdades duras" → use set_personality_mode com mode: "direto"
- Quando usuário disser "modo sábio", "seja mais reflexivo", "me faça pensar" → use set_personality_mode com mode: "sabio"
- Quando usuário disser "modo parceiro", "seja mais gentil", "preciso de apoio" → use set_personality_mode com mode: "parceiro"
- Após mudar, confirme e ajuste IMEDIATAMENTE seu tom na resposta

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

⚠️ REGRA CRÍTICA DE IDs (USO INTERNO - NUNCA MOSTRAR AO USUÁRIO):
- Todos os IDs no sistema são UUIDs no formato: "8ab82e89-4601-420e-b3f0-9494b9480b27"
- NUNCA JAMAIS invente IDs como "1", "2", "3" ou qualquer número simples
- SEMPRE que precisar editar, excluir, concluir ou atualizar QUALQUER item:
  1. PRIMEIRO chame a função de listagem correspondente (list_tasks, list_habits, list_reminders, list_transactions, list_accounts, list_notes, list_projects, list_journal_entries)
  2. Identifique o item correto pelo título/descrição no resultado retornado
  3. Use o UUID REAL retornado na listagem
- Se o usuário mencionar um item pelo nome, SEMPRE liste primeiro para obter o UUID correto
- Se não encontrar o item, informe ao usuário que não foi encontrado
- ❌ NUNCA MOSTRE IDs/UUIDs AO USUÁRIO nas suas respostas - eles são para uso INTERNO apenas
- Nas suas respostas, refira-se aos itens SEMPRE pelo NOME/TÍTULO, nunca pelo ID
- Mantenha a conversa fluida e natural, sem mencionar termos técnicos como "UUID" ou "ID"

FERRAMENTAS DISPONÍVEIS (CRUD COMPLETO):
- Tarefas: criar, listar, editar, excluir, concluir (complete_task)
- Hábitos: criar, listar, editar, excluir, marcar como feito (log_habit_completion), desmarcar (remove_habit_completion), ver histórico (list_habit_logs)
- Lembretes: criar, listar, editar (incluindo voltar para pendente com is_completed: false), excluir, concluir (complete_reminder)
- Transações: criar (simples, fixas ou PARCELADAS), listar, editar, excluir, pagar (pay_transaction)
- Contas bancárias: criar, listar, editar, excluir
- Notas: criar, listar, editar, excluir
- Projetos: criar, listar, editar, excluir
- Subtarefas de projetos: criar, listar (list_project_tasks), editar (update_project_task), excluir
- Diário: criar, listar, editar, excluir
- Biblioteca de Prompts: criar (create_prompt), listar (list_prompts), editar (update_prompt), excluir (delete_prompt), fixar (pin_prompt), buscar (search_prompts), copiar texto (get_prompt_text)
- Sites Salvos: criar (create_saved_site), listar (list_saved_sites), editar (update_saved_site), excluir (delete_saved_site), fixar (pin_saved_site), buscar (search_saved_sites), obter URL (get_site_url)
- Contexto pessoal: atualizar (update_user_context)
- Nome do usuário: atualizar (update_user_name)
- Avatar/foto de perfil: atualizar URL (update_avatar_url), remover (remove_avatar)
- Reset completo: excluir todos os dados (delete_all_user_data)

📊 AXIOM SCORE (0-1000 pontos, 5 pilares de 200 cada):
- "Qual meu score?" ou "Como estou?" → use get_axiom_score para mostrar score atual com breakdown dos pilares
- "Por que meu score caiu?" → use analyze_score_drop para comparar com período anterior
- "Como melhorar meu score?" → use get_score_improvement_suggestions para sugestões priorizadas
- "Mostre evolução" ou "Histórico do score" → use get_score_history e mencione que detalhes visuais estão no Motor de Inteligência
- SEMPRE apresente o score de forma natural e motivadora, contextualizando os números
- Quando ações forem concluídas (tarefas, hábitos, etc), mencione o impacto positivo no score

💳 REGRAS PARA PARCELAS (MUITO IMPORTANTE):
Quando o usuário mencionar "parcelado", "em X vezes", "Xx" (ex: 10x, 3x, 12x):
- Use is_installment: true
- Use total_installments: [número de parcelas]
- O AMOUNT é o valor DE CADA PARCELA, não o valor total
- O payment_method geralmente é "Crédito" para parcelas

EXEMPLOS DE PARCELAS:
- "Comprei uma TV de 500 reais em 10x"
  → amount: 500, is_installment: true, total_installments: 10
  → Sistema cria 10 transações de R$500 cada (total R$5000)

- "Parcelei o celular em 12 vezes de 150"
  → amount: 150, is_installment: true, total_installments: 12
  → Sistema cria 12 transações de R$150 cada

- "Gastei 800 em 4x no cartão"
  → amount: 200 (800/4), is_installment: true, total_installments: 4
  → Sistema cria 4 transações de R$200 cada

ATENÇÃO: Se o usuário disser "gastei X em Yx", divida X por Y para obter o valor da parcela!

EXEMPLOS DE USO CORRETO:
- Usuário: "marca o hábito de flexões como feito"
  → Primeiro: chame list_habits
  → Encontre o hábito "Flexões" e pegue seu UUID (ex: "abc123...")
  → Depois: chame log_habit_completion com habit_id: "abc123..."

- Usuário: "conclui a tarefa da reunião"
  → Primeiro: chame list_tasks
  → Encontre a tarefa sobre reunião e pegue seu UUID
  → Depois: chame complete_task com o UUID

- Usuário: "exclui a despesa do almoço"
  → Primeiro: chame list_transactions
  → Encontre a transação do almoço e pegue seu UUID
  → Depois: chame delete_transaction com o UUID

GUIE O USUÁRIO CORRETAMENTE:
- Se o usuário fornecer informações incompletas, pergunte o que falta antes de executar
- Para transações, sempre confirme: valor, tipo (receita/despesa), categoria e forma de pagamento
- Se o usuário quiser resetar tudo, confirme DUAS vezes antes de executar delete_all_user_data
- Quando criar algo, confirme o que foi criado com os detalhes
- Para voltar um lembrete para pendente, use update_reminder com is_completed: false

Responda SEMPRE em português brasileiro. Seja conciso mas impactante. Não seja genérico - seja específico e direcionado.`;

    console.log(`Processing chat for user: ${userName} (${user.id}) with model: gpt-5.2`);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.2",
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
                    console.log(`Tool calls received: ${toolCalls.map(tc => tc.function.name).join(", ")}`);
                    
                    // Loop para processar múltiplas chamadas de ferramentas em sequência
                    let currentMessages = [
                      { role: "system", content: systemPrompt },
                      ...messages
                    ];
                    let currentToolCalls = [...toolCalls];
                    let maxIterations = 10; // Limite de segurança
                    let iteration = 0;
                    
                    while (currentToolCalls.length > 0 && iteration < maxIterations) {
                      iteration++;
                      console.log(`Tool iteration ${iteration}: executing ${currentToolCalls.map(tc => tc.function.name).join(", ")}`);
                      
                      const toolResults = [];
                      for (const tc of currentToolCalls) {
                        try {
                          const args = JSON.parse(tc.function.arguments);
                          console.log(`Executing tool: ${tc.function.name}`, JSON.stringify(args));
                          const result = await executeTool(supabaseAdmin, user.id, tc.function.name, args);
                          console.log(`Tool result for ${tc.function.name}:`, JSON.stringify(result).substring(0, 500));
                          toolResults.push({ tool_call_id: tc.id, role: "tool", content: JSON.stringify(result) });
                          
                          if (result.success) {
                            executedActions.push(tc.function.name);
                          }
                        } catch (e) {
                          console.error("Tool execution error:", e);
                          toolResults.push({ tool_call_id: tc.id, role: "tool", content: JSON.stringify({ error: String(e) }) });
                        }
                      }
                      
                      // Adicionar assistant message com tool_calls e resultados
                      currentMessages = [
                        ...currentMessages,
                        { 
                          role: "assistant", 
                          tool_calls: currentToolCalls.map(tc => ({
                            id: tc.id,
                            type: "function",
                            function: { name: tc.function.name, arguments: tc.function.arguments }
                          }))
                        },
                        ...toolResults
                      ];
                      
                      // Chamada de follow-up COM tools e tool_choice para permitir mais chamadas
                      console.log(`Follow-up API call ${iteration}...`);
                      const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${openAIApiKey}`,
                          "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                          model: "gpt-5.2",
                          messages: currentMessages,
                          tools,
                          tool_choice: "auto",
                          stream: true
                        })
                      });
                      
                      if (!followUpResponse.ok) {
                        const errorText = await followUpResponse.text();
                        console.error("Follow-up API error:", errorText);
                        break;
                      }
                      
                      // Processar resposta do follow-up
                      const followUpReader = followUpResponse.body?.getReader();
                      let newToolCalls: any[] = [];
                      let gotTextResponse = false;
                      
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
                              const fuDelta = fuParsed.choices?.[0]?.delta;
                              const fuFinishReason = fuParsed.choices?.[0]?.finish_reason;
                              
                              // Capturar novas tool_calls
                              if (fuDelta?.tool_calls) {
                                for (const tc of fuDelta.tool_calls) {
                                  if (tc.index !== undefined) {
                                    if (!newToolCalls[tc.index]) {
                                      newToolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                                    }
                                    if (tc.function?.name) newToolCalls[tc.index].function.name = tc.function.name;
                                    if (tc.function?.arguments) newToolCalls[tc.index].function.arguments += tc.function.arguments;
                                  }
                                }
                              }
                              
                              // Enviar conteúdo de texto
                              if (fuDelta?.content) {
                                gotTextResponse = true;
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fuDelta.content })}\n\n`));
                              }
                              
                              // Log finish reason
                              if (fuFinishReason) {
                                console.log(`Follow-up ${iteration} finish_reason: ${fuFinishReason}`);
                              }
                            } catch (parseError) {
                              console.error("Follow-up parse error:", parseError);
                            }
                          }
                        }
                      }
                      
                      // Se há novas tool_calls, continuar o loop
                      if (newToolCalls.length > 0 && newToolCalls.some(tc => tc && tc.function?.name)) {
                        currentToolCalls = newToolCalls.filter(tc => tc && tc.function?.name);
                        console.log(`New tool calls detected: ${currentToolCalls.map(tc => tc.function.name).join(", ")}`);
                      } else {
                        // Sem mais tool_calls, sair do loop
                        currentToolCalls = [];
                        console.log(`No more tool calls, finishing after ${iteration} iteration(s)`);
                      }
                    }
                    
                    if (iteration >= maxIterations) {
                      console.warn("Max tool iterations reached!");
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
