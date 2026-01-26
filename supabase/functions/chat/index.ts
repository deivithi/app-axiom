import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ===== INPUT VALIDATION SCHEMAS =====
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().max(50000, 'Message content too long').optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string()
    })
  })).optional(),
  tool_call_id: z.string().optional()
}).refine(data => data.content !== undefined || data.tool_calls !== undefined, {
  message: 'Either content or tool_calls must be provided'
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, 'At least one message required').max(100, 'Too many messages')
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Formatação manual de moeda brasileira (R$ 14.961,00)
const formatCurrency = (value: number): string => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedValue = `${formattedInteger},${decimalPart}`;
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
};

// ===== HELPER FUNCTION PARA DATAS NO TIMEZONE DO BRASIL =====
function getBrazilDate(dateStr?: string): { date: Date; dateStr: string; referenceMonth: string } {
  let date: Date;
  
  if (dateStr) {
    // Data específica fornecida - usar meio-dia no timezone Brasil para evitar problemas
    // Força a interpretação como data local do Brasil
    const [year, month, day] = dateStr.split('-').map(Number);
    date = new Date(year, month - 1, day, 12, 0, 0);
  } else {
    // Sem data - usar horário atual do Brasil (UTC-3)
    const now = new Date();
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    date = brazilTime;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return {
    date,
    dateStr: `${year}-${month}-${day}`,
    referenceMonth: `${year}-${month}`
  };
}

// Helper para obter string de data no Brasil (YYYY-MM-DD)
function getBrazilDateStr(date?: Date): string {
  const d = date || new Date();
  const brazilDate = new Date(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const year = brazilDate.getFullYear();
  const month = String(brazilDate.getMonth() + 1).padStart(2, '0');
  const day = String(brazilDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper para obter Date atual no timezone do Brasil
function getBrazilNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

// ===== HELPER PARA ADICIONAR MESES SEM OVERFLOW DE DIAS =====
function addMonthsSafe(baseDate: Date, monthsToAdd: number): Date {
  const result = new Date(baseDate);
  const originalDay = result.getDate();
  
  // Primeiro vai para dia 1 para evitar overflow
  result.setDate(1);
  result.setMonth(result.getMonth() + monthsToAdd);
  
  // Depois ajusta para o dia correto (ou último dia do mês se necessário)
  const lastDayOfMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfMonth));
  
  return result;
}

// ===== FUNÇÃO PARA SANITIZAR ARGUMENTOS DA Z.AI =====
// A z.ai (GLM-4.7) às vezes serializa booleanos como strings ("true"/"false")
// e números como strings, causando falhas silenciosas. Esta função corrige.
function sanitizeZaiArgs(args: any): any {
  if (!args || typeof args !== 'object') return args;
  
  const sanitized = { ...args };
  
  // Campos booleanos que devem ser convertidos
  const booleanFields = [
    'is_paid', 'is_fixed', 'is_installment', 'is_recurring', 'is_pinned', 
    'is_completed', 'completed', 'include_completed'
  ];
  
  for (const field of booleanFields) {
    if (sanitized[field] !== undefined) {
      // Converte string "true"/"false" para boolean
      if (sanitized[field] === 'true' || sanitized[field] === true) {
        sanitized[field] = true;
      } else if (sanitized[field] === 'false' || sanitized[field] === false) {
        sanitized[field] = false;
      }
    }
  }
  
  // Campos numéricos que devem ser convertidos
  const numberFields = [
    'amount', 'balance', 'total_installments', 'recurrence_day', 'days', 
    'limit', 'target_amount', 'current_amount', 'progress'
  ];
  
  for (const field of numberFields) {
    if (sanitized[field] !== undefined && typeof sanitized[field] === 'string') {
      const parsed = parseFloat(sanitized[field]);
      if (!isNaN(parsed)) {
        sanitized[field] = parsed;
      }
    }
  }
  
  return sanitized;
}

// ===== RATE LIMITING =====
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 60; // 60 requests
const RATE_LIMIT_WINDOW = 60 * 1000; // per minute (60 seconds)

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or new user
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetTime - now };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count, resetIn: userLimit.resetTime - now };
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimitMap.entries()) {
    if (now > limit.resetTime) {
      rateLimitMap.delete(userId);
    }
  }
}, 5 * 60 * 1000);

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
      description: "Cria uma nova transação financeira (receita ou despesa). CRÍTICO: SEMPRE envie transaction_date (YYYY-MM-DD) - consulte CALENDÁRIO no system prompt para a data correta. Se usuário não mencionar data, use a data de HOJE. NUNCA omita transaction_date! Suporta: transações simples, fixas (is_fixed=true com recurrence_day), ou parceladas (is_installment=true + total_installments). Para parcelas, amount é o valor DE CADA PARCELA. Para transações fixas, use recurrence_day para definir o dia do mês em que a transação recorre (ex: 'todo dia 5'). IMPORTANTE: Se o usuário diz 'gastei' ou 'paguei', significa que a transação JÁ FOI PAGA, então use is_paid=true.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título/descrição da transação" },
          amount: { type: "number", description: "Valor da transação. Para parcelas, é o valor de CADA parcela (não o total)" },
          type: { type: "string", enum: ["income", "expense"], description: "Tipo: receita ou despesa" },
          category: { type: "string", description: "Categoria da transação" },
          transaction_date: { type: "string", description: "OBRIGATÓRIO: Data no formato YYYY-MM-DD. Use CALENDÁRIO do system prompt. Se não mencionada pelo usuário, use HOJE. NUNCA deixe em branco!" },
          is_paid: { type: "boolean", description: "Se a transação já foi paga. Use is_paid=true quando usuário diz 'gastei', 'paguei', 'comprei' (ação já realizada). Use is_paid=false para despesas futuras ou planejadas." },
          is_fixed: { type: "boolean", description: "Se é uma despesa fixa/recorrente (aparece todos os meses). Use com recurrence_day para definir o dia." },
          recurrence_day: { type: "number", description: "Dia do mês para transações fixas (1-31). Ex: 5 para 'todo dia 5', 10 para 'todo dia 10'. Se usuário mencionar 'dia 5' ou 'todo dia 5', use recurrence_day=5. Se não informado, usa o dia de transaction_date." },
          is_installment: { type: "boolean", description: "Se é uma compra parcelada (ex: 10x, 12x). Use junto com total_installments" },
          total_installments: { type: "number", description: "Número total de parcelas (ex: 10 para 10x, 12 para 12x). Obrigatório quando is_installment=true" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Forma de pagamento. Para parcelas, geralmente é Crédito" },
          account_id: { type: "string", description: "UUID da conta bancária vinculada (opcional). Obtenha de list_accounts. Quando is_paid=true E account_id está definido, o saldo da conta será atualizado automaticamente." }
        },
        required: ["title", "amount", "type", "category", "transaction_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_batch_transactions",
      description: "Cria múltiplas transações de uma vez. Use quando o usuário listar vários itens (ex: 'comprei pão (10), leite (5) e café (15)'). Mais eficiente que chamar create_transaction várias vezes.",
      parameters: {
        type: "object",
        properties: {
          transactions: { 
            type: "array", 
            description: "Lista de transações a criar",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título/descrição do item" },
                amount: { type: "number", description: "Valor do item" },
                category: { type: "string", description: "Categoria do item" }
              },
              required: ["title", "amount", "category"]
            }
          },
          type: { type: "string", enum: ["income", "expense"], description: "Tipo para todas as transações" },
          transaction_date: { type: "string", description: "Data para todas as transações (YYYY-MM-DD)" },
          payment_method: { type: "string", enum: ["PIX", "Débito", "Crédito"], description: "Forma de pagamento" },
          account_id: { type: "string", description: "UUID da conta bancária para todas as transações (opcional). Obtenha de list_accounts." },
          is_paid: { type: "boolean", description: "Se todas as transações já foram pagas (default: false). Se usuário disse 'paguei' ou 'gastei', use true." }
        },
        required: ["transactions", "type", "transaction_date"]
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
          transaction_date: { type: "string", description: "Nova data da transação (YYYY-MM-DD)" },
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
      description: "Marca uma transação como paga e atualiza automaticamente o saldo da conta vinculada. IMPORTANTE: O ID deve ser um UUID real obtido de list_transactions.",
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
      name: "unpay_transaction",
      description: "Marca uma transação como NÃO paga (reverte pagamento) e atualiza automaticamente o saldo da conta vinculada. IMPORTANTE: O ID deve ser um UUID real obtido de list_transactions.",
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
  },
  // ONBOARDING
  {
    type: "function",
    function: {
      name: "apply_onboarding_template",
      description: "Aplica um template de onboarding criando projetos e hábitos pré-configurados para o perfil escolhido. Use quando o usuário escolher um perfil como 'Empreendedor Solo', 'Executivo Corporativo', etc.",
      parameters: {
        type: "object",
        properties: {
          template_type: {
            type: "string",
            enum: ["empreendedor", "executivo", "freelancer", "vendas"],
            description: "Tipo do template de perfil"
          },
          custom_habits: {
            type: "array",
            items: { type: "string" },
            description: "Hábitos adicionais solicitados pelo usuário"
          },
          custom_projects: {
            type: "array",
            items: { type: "string" },
            description: "Projetos adicionais solicitados pelo usuário"
          }
        },
        required: ["template_type"]
      }
    }
  },
  // WEEKLY REPORTS
  {
    type: "function",
    function: {
      name: "list_weekly_reports",
      description: "Lista os relatórios semanais do Axiom Insights do usuário. Use quando o usuário pedir 'mostre insights anteriores', '/insights', 'ver relatórios', etc.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número de relatórios a buscar (default: 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_weekly_report",
      description: "Gera um novo relatório semanal do Axiom Insights imediatamente. Use quando o usuário pedir 'gerar relatório', 'fazer análise semanal', 'quero meu insight semanal', etc.",
      parameters: { type: "object", properties: {} }
    }
  },
  // CFO PESSOAL - FERRAMENTAS FINANCEIRAS AVANÇADAS
  {
    type: "function",
    function: {
      name: "predict_month_end",
      description: "Analisa padrão de gastos dos últimos 60-90 dias e prevê se o usuário terá saldo positivo ou déficit no fim do mês. Use quando perguntarem 'vou ter dinheiro?', 'vou fechar no azul?', 'previsão do mês', 'como vou terminar o mês?'",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "simulate_expense_cut",
      description: "Simula quanto o usuário economizaria cortando determinadas despesas. Use quando perguntarem 'se eu cortar X?', 'quanto economizo sem Netflix?', 'simule cortar delivery', 'e se eu cancelar...'",
      parameters: {
        type: "object",
        properties: {
          categories: { type: "array", items: { type: "string" }, description: "Categorias a simular corte (ex: ['Delivery', 'Assinaturas'])" },
          items: { type: "array", items: { type: "string" }, description: "Itens específicos por título (ex: ['Netflix', 'Spotify'])" },
          reduction_percent: { type: "number", description: "Percentual de redução (0-100). Se não informado, assume corte total (100%)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_spending_behavior",
      description: "Analisa correlações entre gastos e comportamentos (horário, dia da semana, humor, hábitos). Use quando perguntarem 'por que meu dinheiro some?', 'padrões de gasto', 'análise comportamental', 'onde está indo meu dinheiro?'",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_expenses_by_category",
      description: "Obtém breakdown detalhado de gastos por categoria com subcategorias e comparativos. Use quando perguntarem 'quanto gastei em alimentação?', 'detalhes de gastos', 'breakdown por categoria', 'gastos em transporte'",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Categoria específica para detalhar (ex: 'Alimentação', 'Transporte')" },
          period: { type: "string", enum: ["week", "month", "quarter"], description: "Período de análise (default: month)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_financial_goal",
      description: "Cria uma meta financeira com plano de ação sugerido. Use quando disserem 'quero juntar X', 'meta de economia', 'guardar dinheiro para...', 'quero economizar'",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome da meta (ex: 'Reserva de emergência', 'Viagem', 'Curso')" },
          target_amount: { type: "number", description: "Valor alvo em reais" },
          deadline_months: { type: "number", description: "Prazo em meses (opcional)" }
        },
        required: ["title", "target_amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "track_financial_goal",
      description: "Acompanha progresso de uma meta financeira existente. Use quando perguntarem 'como está minha meta?', 'quanto falta para...', 'progresso da economia'",
      parameters: {
        type: "object",
        properties: {
          goal_id: { type: "string", description: "UUID da meta (use list_financial_goals primeiro)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_financial_goals",
      description: "Lista as metas financeiras do usuário. SEMPRE use primeiro para obter IDs antes de update, delete ou track.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "update_financial_goal",
      description: "Atualiza uma meta financeira existente. IMPORTANTE: O ID deve ser um UUID real obtido de list_financial_goals.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da meta (obtenha de list_financial_goals primeiro)" },
          title: { type: "string", description: "Novo título da meta" },
          target_amount: { type: "number", description: "Novo valor alvo em reais" },
          current_amount: { type: "number", description: "Atualizar valor atual acumulado" },
          deadline: { type: "string", description: "Nova data limite (YYYY-MM-DD)" },
          status: { type: "string", enum: ["active", "completed", "cancelled"], description: "Novo status" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_financial_goal",
      description: "Exclui uma meta financeira. IMPORTANTE: O ID deve ser um UUID real obtido de list_financial_goals.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID da meta (obtenha de list_financial_goals primeiro)" }
        },
        required: ["id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "suggest_transaction_category",
      description: "Sugere categoria para uma transação baseado no histórico do usuário. Use quando o usuário informar um gasto sem categoria ou quando quiser deduzir a categoria.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Valor da transação" },
          description: { type: "string", description: "Descrição opcional do gasto" }
        },
        required: ["amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_bills",
      description: "Lista transações pendentes que vencem nos próximos X dias. Use quando perguntarem sobre contas a pagar, boletos vencendo, compromissos financeiros.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Dias para frente (default: 7)" }
        }
      }
    }
  },
  // MEMORY SYSTEM
  {
    type: "function",
    function: {
      name: "search_memories",
      description: "Busca nas memórias de longo prazo do usuário. Use quando precisar relembrar preferências, metas, padrões comportamentais ou fatos sobre o usuário. Exemplo: 'o que sei sobre as metas dele?', 'quais são os padrões de comportamento?'",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca nas memórias" },
          types: { 
            type: "array", 
            items: { type: "string", enum: ["personality", "routine", "goal", "pattern", "preference", "fact", "insight"] },
            description: "Tipos de memória para filtrar (opcional)" 
          },
          limit: { type: "number", description: "Número máximo de memórias (default: 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Salva explicitamente uma informação importante sobre o usuário na memória de longo prazo. Use quando o usuário compartilhar algo significativo que deve ser lembrado em conversas futuras.",
      parameters: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["personality", "routine", "goal", "pattern", "preference", "fact", "insight"],
            description: "Tipo da memória: personality (preferências de comunicação), routine (padrões de rotina), goal (metas), pattern (comportamentos recorrentes), preference (preferências gerais), fact (fatos sobre o usuário), insight (descobertas comportamentais)"
          },
          content: { type: "string", description: "Conteúdo da memória (frase clara e autossuficiente)" },
          topics: { type: "array", items: { type: "string" }, description: "Tópicos relacionados (ex: ['Score', 'Hábitos'])" },
          confidence: { type: "number", description: "Nível de confiança 1-5 (5 = muito certo)" }
        },
        required: ["type", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_learning_insights",
      description: "Lista o que o Axiom aprendeu sobre o usuário, organizado por categoria. Use quando perguntarem 'o que você sabe sobre mim?', 'suas memórias', 'o que aprendeu?'",
      parameters: {
        type: "object",
        properties: {
          type: { 
            type: "string", 
            enum: ["personality", "routine", "goal", "pattern", "preference", "fact", "insight"],
            description: "Filtrar por tipo específico (opcional)" 
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "archive_memory",
      description: "Arquiva uma memória que não é mais relevante. Use quando o usuário disser que uma informação mudou ou não é mais válida.",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "UUID da memória (obtenha de list_learning_insights primeiro)" }
        },
        required: ["memory_id"]
      }
    }
  },
  // EXECUTE PROMPT WITH VARIABLES
  {
    type: "function",
    function: {
      name: "execute_prompt",
      description: "Executa um prompt salvo na biblioteca, injetando variáveis dinâmicas do usuário (como {{axiom_score}}, {{saldo_total}}, etc). Use quando o usuário pedir 'usa o prompt X', 'executa o prompt Y', 'roda o prompt Z'. Retorna o prompt processado para você usar como contexto na resposta.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID do prompt (obtenha de list_prompts primeiro)" },
          use_optimized: { type: "boolean", description: "Se true, usa a versão otimizada do prompt (se disponível). Default: true" }
        },
        required: ["id"]
      }
    }
  }
];

// Onboarding templates
const onboardingTemplates: Record<string, { name: string; projects: Array<{ title: string; description: string }>; habits: Array<{ title: string; frequency: string; color: string }> }> = {
  empreendedor: {
    name: "Empreendedor Solo",
    projects: [
      { title: "Produto", description: "Desenvolvimento e melhorias do produto/serviço" },
      { title: "Marketing", description: "Estratégias de aquisição e branding" },
      { title: "Vendas", description: "Pipeline comercial e conversões" },
      { title: "Financeiro", description: "Fluxo de caixa e contabilidade" }
    ],
    habits: [
      { title: "Deep Work", frequency: "daily", color: "#8B5CF6" },
      { title: "Networking", frequency: "weekly", color: "#14B8A6" },
      { title: "Exercício Físico", frequency: "daily", color: "#F97316" }
    ]
  },
  executivo: {
    name: "Executivo Corporativo",
    projects: [
      { title: "OKRs", description: "Objetivos e resultados-chave do trimestre" },
      { title: "Gestão de Time", description: "Desenvolvimento e performance da equipe" },
      { title: "Stakeholders", description: "Relacionamento com stakeholders estratégicos" }
    ],
    habits: [
      { title: "Reunião 1:1", frequency: "weekly", color: "#3B82F6" },
      { title: "Leitura Estratégica", frequency: "daily", color: "#8B5CF6" },
      { title: "Autocuidado", frequency: "daily", color: "#22C55E" }
    ]
  },
  freelancer: {
    name: "Freelancer Criativo",
    projects: [
      { title: "Clientes Ativos", description: "Projetos em andamento para clientes" },
      { title: "Portfólio", description: "Atualização e showcase de trabalhos" },
      { title: "Prospecção", description: "Busca ativa de novos clientes" }
    ],
    habits: [
      { title: "Bloco Criativo", frequency: "daily", color: "#EC4899" },
      { title: "Admin & Finanças", frequency: "weekly", color: "#14B8A6" },
      { title: "Aprendizado", frequency: "daily", color: "#8B5CF6" }
    ]
  },
  vendas: {
    name: "Profissional de Vendas",
    projects: [
      { title: "Pipeline", description: "Gestão de oportunidades e negociações" },
      { title: "Comissões", description: "Tracking de metas e comissões" },
      { title: "Eventos", description: "Participação em eventos e networking" }
    ],
    habits: [
      { title: "Prospecção Ativa", frequency: "daily", color: "#F97316" },
      { title: "Follow-up", frequency: "daily", color: "#3B82F6" },
      { title: "Estudo de Produto", frequency: "weekly", color: "#8B5CF6" }
    ]
  }
};
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

async function executeTool(supabaseAdmin: any, userId: string, toolName: string, rawArgs: any) {
  // SANITIZAR ARGUMENTOS DA Z.AI - converte "true"/"false" strings para booleans
  const args = sanitizeZaiArgs(rawArgs);
  console.log(`Executing tool: ${toolName}`, { rawArgs, sanitizedArgs: args });

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
      const today = getBrazilDateStr();
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
      // Usar helper de timezone do Brasil
      const { dateStr: completedDate } = getBrazilDate(args.completed_at);
      
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
      // Usar helper de timezone do Brasil
      const { dateStr: completedDate } = getBrazilDate(args.completed_at);
      
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
        .gte("completed_at", getBrazilDateStr(startDate))
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
      // ===== USAR HELPER DE DATA COM TIMEZONE DO BRASIL =====
      const { date: transactionDate, dateStr: transactionDateStr, referenceMonth } = getBrazilDate(args.transaction_date);
      
      // PARCELAS: Criar todas as parcelas a partir da data informada
      // CORREÇÃO 4: Suporte a is_paid na primeira parcela
      if (args.is_installment && args.total_installments && args.total_installments > 1) {
        const isPaidFirstInstallment = args.is_paid === true;
        const installments = [];
        
        for (let i = 1; i <= args.total_installments; i++) {
          // USAR MÉTODO SEGURO PARA ADICIONAR MESES (evita overflow de dias)
          const installmentDate = addMonthsSafe(transactionDate, i - 1);
          const { dateStr: instDateStr, referenceMonth: instMonth } = getBrazilDate(
            `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}-${String(installmentDate.getDate()).padStart(2, '0')}`
          );
          
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
            // CORREÇÃO 4: Primeira parcela pode estar paga, demais não
            is_paid: i === 1 ? isPaidFirstInstallment : false,
            transaction_date: instDateStr,
            reference_month: instMonth,
            account_id: args.account_id || null
          });
        }
        
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .insert(installments)
          .select();
        
        if (error) throw error;
        
        // CORREÇÃO 4: Se primeira parcela paga E tem conta, atualizar saldo
        if (isPaidFirstInstallment && args.account_id) {
          const { data: account } = await supabaseAdmin
            .from("accounts")
            .select("balance")
            .eq("id", args.account_id)
            .eq("user_id", userId)
            .single();
          
          if (account) {
            const delta = args.type === "income" ? Number(args.amount) : -Number(args.amount);
            await supabaseAdmin
              .from("accounts")
              .update({ balance: Number(account.balance) + delta })
              .eq("id", args.account_id);
            console.log(`Installment: First installment paid, account ${args.account_id} updated, delta: ${delta}`);
          }
        }
        
        // Calcular datas de início e fim para mensagem
        const lastDate = addMonthsSafe(transactionDate, args.total_installments - 1);
        const firstMonth = transactionDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const lastMonth = lastDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const totalValue = args.amount * args.total_installments;
        
        const paidMsg = isPaidFirstInstallment ? " 1ª parcela já paga! ✅" : "";
        const accountMsg = isPaidFirstInstallment && args.account_id ? " Saldo da conta atualizado!" : "";
        
        return { 
          success: true, 
          transactions: data,
          installments_created: args.total_installments,
          amount_per_installment: args.amount,
          total_value: totalValue,
          first_installment_date: transactionDateStr,
          message: `🛒 Compra parcelada criada! "${args.title}" em ${args.total_installments}x de ${formatCurrency(args.amount)} (total: ${formatCurrency(totalValue)}). Parcelas lançadas de ${firstMonth} até ${lastMonth}, iniciando em ${transactionDate.toLocaleDateString('pt-BR')}.${paidMsg}${accountMsg}`
        };
      }
      
      // Transação simples ou fixa - AGORA USA transaction_date e recurrence_day
      // Calculate recurrence_day: use provided value, or extract from transaction_date
      const recurrenceDay = args.is_fixed 
        ? (args.recurrence_day || transactionDate.getDate())
        : null;
      
      // CORREÇÃO CRÍTICA: Usar is_paid do args (após sanitização)
      const isPaid = args.is_paid === true;
      
      const { data, error } = await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        title: args.title,
        amount: args.amount,
        type: args.type,
        category: args.category,
        is_fixed: args.is_fixed || false,
        is_installment: false,
        payment_method: args.payment_method || "PIX",
        is_paid: isPaid,  // ← USAR valor sanitizado ao invés de hardcoded false
        transaction_date: transactionDateStr,
        reference_month: args.is_fixed ? referenceMonth : null,
        account_id: args.account_id || null,
        recurrence_day: recurrenceDay
      }).select().single();
      if (error) throw error;
      
      // CORREÇÃO CRÍTICA: Se criada como paga E tem conta vinculada, atualizar saldo
      if (isPaid && args.account_id) {
        const { data: account } = await supabaseAdmin
          .from("accounts")
          .select("balance")
          .eq("id", args.account_id)
          .eq("user_id", userId)
          .single();
        
        if (account) {
          const delta = args.type === "income" ? Number(args.amount) : -Number(args.amount);
          await supabaseAdmin
            .from("accounts")
            .update({ balance: Number(account.balance) + delta })
            .eq("id", args.account_id);
          console.log(`Account balance updated: ${args.account_id}, delta: ${delta}`);
        }
      }
      
      const dateMsg = args.transaction_date ? ` para ${transactionDate.toLocaleDateString('pt-BR')}` : "";
      const fixedMsg = args.is_fixed ? ` (recorrente - todo dia ${recurrenceDay} de cada mês)` : "";
      const paidMsg = isPaid ? " ✅ Já paga!" : "";
      const accountMsg = isPaid && args.account_id ? " Saldo da conta atualizado!" : (args.account_id ? " Vinculada à conta." : "");
      return { success: true, transaction: data, message: `Transação "${args.title}"${dateMsg} criada com sucesso!${fixedMsg}${paidMsg}${accountMsg} 💰` };
    }

    case "create_batch_transactions": {
      const { date: transactionDate, dateStr: transactionDateStr, referenceMonth } = getBrazilDate(args.transaction_date);
      
      // CORREÇÃO 3: Suporte a account_id e is_paid em lote
      const isPaid = args.is_paid === true;
      
      const transactionsToInsert = args.transactions.map((t: any) => ({
        user_id: userId,
        title: t.title,
        amount: t.amount,
        type: args.type,
        category: t.category,
        is_fixed: false,
        is_installment: false,
        payment_method: args.payment_method || "PIX",
        is_paid: isPaid,  // ← USAR valor do args
        transaction_date: transactionDateStr,
        reference_month: referenceMonth,
        account_id: args.account_id || null  // ← VINCULAR CONTA
      }));
      
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .insert(transactionsToInsert)
        .select();
      
      if (error) throw error;
      
      const total = args.transactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      
      // CORREÇÃO 3: Se pago E tem conta, atualizar saldo
      if (isPaid && args.account_id) {
        const { data: account } = await supabaseAdmin
          .from("accounts")
          .select("balance")
          .eq("id", args.account_id)
          .eq("user_id", userId)
          .single();
        
        if (account) {
          // Para despesas, subtrai; para receitas, soma
          const delta = args.type === "income" ? total : -total;
          await supabaseAdmin
            .from("accounts")
            .update({ balance: Number(account.balance) + delta })
            .eq("id", args.account_id);
          console.log(`Batch: Account ${args.account_id} balance updated, delta: ${delta}`);
        }
      }
      
      const itemsList = args.transactions.map((t: any) => `${t.title} (${formatCurrency(Number(t.amount))})`).join(", ");
      const paidMsg = isPaid ? " ✅ Já pagas!" : "";
      const accountMsg = isPaid && args.account_id ? " Saldo da conta atualizado!" : "";
      
      return { 
        success: true, 
        transactions: data,
        count: data.length,
        total,
        message: `✅ ${data.length} transações criadas: ${itemsList}. Total: ${formatCurrency(total)}${paidMsg}${accountMsg} 💰`
      };
    }

    case "update_transaction": {
      // CORREÇÃO 1: Buscar transação ANTES para detectar mudanças em is_paid e amount
      const { data: existingTxn, error: fetchError } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();
      
      if (fetchError || !existingTxn) {
        throw new Error("Transação não encontrada");
      }
      
      // CORREÇÃO 1: Se is_paid está mudando, usar funções atômicas
      if (args.is_paid !== undefined && args.is_paid !== existingTxn.is_paid) {
        if (args.is_paid === true) {
          // false → true: usar pay_transaction_atomic
          const { error: rpcError } = await supabaseAdmin.rpc('pay_transaction_atomic', {
            p_transaction_id: args.id,
            p_user_id: userId
          });
          if (rpcError) throw rpcError;
          console.log(`update_transaction: Used pay_transaction_atomic for ${args.id}`);
        } else {
          // true → false: usar unpay_transaction_atomic
          const { error: rpcError } = await supabaseAdmin.rpc('unpay_transaction_atomic', {
            p_transaction_id: args.id,
            p_user_id: userId
          });
          if (rpcError) throw rpcError;
          console.log(`update_transaction: Used unpay_transaction_atomic for ${args.id}`);
        }
      }
      
      // CORREÇÃO 1: Se amount está mudando E transação está/ficará paga, ajustar saldo
      const willBePaid = args.is_paid !== undefined ? args.is_paid : existingTxn.is_paid;
      const accountId = args.account_id !== undefined ? args.account_id : existingTxn.account_id;
      
      if (args.amount !== undefined && args.amount !== existingTxn.amount && willBePaid && accountId) {
        const oldAmount = Number(existingTxn.amount);
        const newAmount = Number(args.amount);
        const delta = existingTxn.type === "income" 
          ? (newAmount - oldAmount)  // Receita: diferença positiva = mais dinheiro
          : (oldAmount - newAmount); // Despesa: diferença negativa = devolver dinheiro
        
        if (delta !== 0) {
          const { data: account } = await supabaseAdmin
            .from("accounts")
            .select("balance")
            .eq("id", accountId)
            .single();
          
          if (account) {
            await supabaseAdmin
              .from("accounts")
              .update({ balance: Number(account.balance) + delta })
              .eq("id", accountId);
            console.log(`update_transaction: Adjusted account balance by ${delta} for amount change`);
          }
        }
      }
      
      // Atualizar outros campos (exceto is_paid que já foi tratado)
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.amount !== undefined) updateData.amount = args.amount;
      if (args.type) updateData.type = args.type;
      if (args.category) updateData.category = args.category;
      if (args.transaction_date) updateData.transaction_date = args.transaction_date;
      if (args.payment_method) updateData.payment_method = args.payment_method;
      if (args.account_id !== undefined) updateData.account_id = args.account_id || null;
      // NÃO incluir is_paid aqui - já foi tratado atomicamente

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("transactions")
          .update(updateData)
          .eq("id", args.id)
          .eq("user_id", userId);
        if (updateError) throw updateError;
      }
      
      // Buscar transação atualizada para resposta
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("id", args.id)
        .single();
      
      const dateMsg = args.transaction_date ? ` data alterada para ${new Date(args.transaction_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : "";
      const paidMsg = args.is_paid === true ? " e marcada como paga ✅ (saldo atualizado)" : (args.is_paid === false ? " e marcada como pendente (saldo revertido)" : "");
      const amountMsg = args.amount !== undefined && args.amount !== existingTxn.amount ? ` valor de R$${existingTxn.amount} para R$${args.amount}` : "";
      return { success: true, transaction: data, message: `Transação "${data.title}" atualizada${amountMsg}${dateMsg}${paidMsg}!` };
    }

    case "delete_transaction": {
      // CORREÇÃO 2: Buscar transação completa ANTES de deletar para reverter saldo
      const { data: transaction } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();
      
      if (!transaction) {
        throw new Error("Transação não encontrada");
      }
      
      // CORREÇÃO 2: Se transação estava paga E tinha conta vinculada, reverter saldo
      if (transaction.is_paid && transaction.account_id) {
        const { data: account } = await supabaseAdmin
          .from("accounts")
          .select("balance")
          .eq("id", transaction.account_id)
          .single();
        
        if (account) {
          // Reverter: despesa -> devolve dinheiro (+), receita -> remove dinheiro (-)
          const delta = transaction.type === "expense" 
            ? Number(transaction.amount)   // Devolver dinheiro gasto
            : -Number(transaction.amount); // Remover receita
          
          await supabaseAdmin
            .from("accounts")
            .update({ balance: Number(account.balance) + delta })
            .eq("id", transaction.account_id);
          console.log(`delete_transaction: Reverted account balance by ${delta} for paid transaction`);
        }
      }
      
      // Deletar instâncias recorrentes se for transação fixa original
      if (transaction.is_fixed && !transaction.parent_transaction_id) {
        await supabaseAdmin.from("transactions").delete().eq("parent_transaction_id", args.id);
      }
      
      const { error } = await supabaseAdmin.from("transactions").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      
      const revertMsg = transaction.is_paid && transaction.account_id ? " Saldo da conta revertido!" : "";
      return { success: true, message: `Transação "${transaction.title}" excluída com sucesso!${revertMsg}` };
    }

    case "list_transactions": {
      let query = supabaseAdmin.from("transactions").select("*").eq("user_id", userId);
      if (args.type) query = query.eq("type", args.type);
      if (args.is_paid !== undefined) query = query.eq("is_paid", args.is_paid);
      const { data, error } = await query.order("transaction_date", { ascending: false }).limit(args.limit || 20);
      if (error) throw error;
      
      // Formatar transações com datas legíveis em pt-BR
      const formattedTransactions = data.map((t: any) => {
        const dateObj = new Date(t.transaction_date + 'T12:00:00');
        const dataFormatada = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return {
          ...t,
          data_formatada: dataFormatada
        };
      });
      
      const pendingCount = data.filter((t: any) => !t.is_paid && t.type === "expense").length;
      const pendingMsg = pendingCount > 0 ? ` (${pendingCount} pendentes)` : "";
      
      // Criar lista resumida com datas formatadas
      const transactionsList = formattedTransactions.slice(0, 10).map((t: any) => 
        `- ${t.data_formatada}: ${t.title} | ${formatCurrency(Number(t.amount))} | ${t.type === 'income' ? 'Receita' : 'Despesa'} | ${t.is_paid ? '✅ Pago' : '⏳ Pendente'}`
      ).join('\n');
      
      return { 
        transactions: formattedTransactions, 
        message: `${data.length} transações encontradas${pendingMsg}:\n\n${transactionsList}\n\nUse os IDs (UUIDs) para editar, excluir ou pagar.` 
      };
    }

    case "pay_transaction": {
      // CORREÇÃO: Usar função RPC atômica (race-condition safe) como o frontend
      const { error: rpcError } = await supabaseAdmin.rpc('pay_transaction_atomic', {
        p_transaction_id: args.id,
        p_user_id: userId
      });
      
      if (rpcError) {
        console.error("pay_transaction_atomic error:", rpcError);
        throw new Error(rpcError.message || "Erro ao pagar transação");
      }
      
      // Buscar transação atualizada para resposta
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("*, accounts(name)")
        .eq("id", args.id)
        .single();
      
      const accountMsg = data?.account_id ? ` Saldo da conta "${data.accounts?.name || 'vinculada'}" atualizado!` : "";
      return { success: true, transaction: data, message: `Transação "${data?.title}" marcada como paga! ✅💰${accountMsg}` };
    }
    
    case "unpay_transaction": {
      // NOVA TOOL: Reverter pagamento usando função RPC atômica
      const { error: rpcError } = await supabaseAdmin.rpc('unpay_transaction_atomic', {
        p_transaction_id: args.id,
        p_user_id: userId
      });
      
      if (rpcError) {
        console.error("unpay_transaction_atomic error:", rpcError);
        throw new Error(rpcError.message || "Erro ao reverter pagamento");
      }
      
      // Buscar transação atualizada para resposta
      const { data } = await supabaseAdmin
        .from("transactions")
        .select("*, accounts(name)")
        .eq("id", args.id)
        .single();
      
      const accountMsg = data?.account_id ? ` Saldo da conta "${data.accounts?.name || 'vinculada'}" revertido!` : "";
      return { success: true, transaction: data, message: `Transação "${data?.title}" marcada como NÃO paga! ⏳${accountMsg}` };
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
        .gte("transaction_date", getBrazilDateStr(startOfMonth))
        .order("amount", { ascending: false });
      
      if (error) throw error;
      
      const total = data.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      return { 
        transactions: data, 
        total_pending: total,
        count: data.length,
        message: data.length > 0 
          ? `📋 ${data.length} transações pendentes totalizando ${formatCurrency(total)}. Use os IDs para pagar: ${data.map((t: any) => `"${t.title}" (${t.id})`).join(", ")}`
          : "🎉 Nenhuma transação pendente! Todas as contas estão em dia."
      };
    }

    case "get_finance_summary": {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, error } = await supabaseAdmin.from("transactions").select("*").eq("user_id", userId).gte("transaction_date", getBrazilDateStr(startOfMonth));
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
        message: `💰 Receitas: ${formatCurrency(income)} | 💸 Despesas: ${formatCurrency(expenses)} | ⏳ Pendente: ${formatCurrency(pending)} | 🎯 Saldo: ${formatCurrency(income - expenses)}`
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
        entry_date: getBrazilDateStr()
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

    case "execute_prompt": {
      // 1. Fetch the prompt
      const { data: prompt, error: promptError } = await supabaseAdmin
        .from("prompt_library")
        .select("*")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();
      
      if (promptError || !prompt) {
        return { success: false, message: "Prompt não encontrado. Use list_prompts primeiro para obter o ID correto." };
      }

      // 2. Choose version (optimized if available and requested)
      const useOptimized = args.use_optimized !== false;
      const promptTemplate = useOptimized && prompt.optimized_prompt 
        ? prompt.optimized_prompt 
        : prompt.prompt_text;

      // 3. Inject variables by calling the inject-variables edge function
      let processedPrompt = promptTemplate;
      let variablesUsed: string[] = [];

      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        
        const injectResponse = await fetch(`${supabaseUrl}/functions/v1/inject-variables`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({ promptTemplate, userId })
        });

        if (injectResponse.ok) {
          const injectData = await injectResponse.json();
          processedPrompt = injectData.processedPrompt || promptTemplate;
          variablesUsed = injectData.variablesUsed || [];
        }
      } catch (e) {
        console.error("Error injecting variables:", e);
        // Continue with template without injection
      }

      // 4. Update usage count
      await supabaseAdmin
        .from("prompt_library")
        .update({
          usage_count: (prompt.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq("id", args.id);

      return {
        success: true,
        prompt_name: prompt.title,
        processed_prompt: processedPrompt,
        variables_injected: variablesUsed.length,
        used_optimized: useOptimized && !!prompt.optimized_prompt,
        message: `Prompt "${prompt.title}" carregado! ${variablesUsed.length > 0 ? `${variablesUsed.length} variáveis injetadas.` : ''} Use o processed_prompt como contexto para sua resposta.`
      };
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
      const thirtyDaysAgoStr = getBrazilDateStr(thirtyDaysAgo);

      // 1. EXECUTION
      const { data: tasks } = await supabaseAdmin.from("tasks").select("status").eq("user_id", userId).gte("created_at", thirtyDaysAgoStr);
      const tasksTotal = tasks?.length || 0;
      const tasksCompleted = tasks?.filter((t: any) => t.status === "done").length || 0;
      const executionRate = tasksTotal > 0 ? (tasksCompleted / tasksTotal) : 0;
      const executionScore = Math.round(executionRate * 200);

      // 2. FINANCIAL
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: transactions } = await supabaseAdmin.from("transactions").select("amount, type, transaction_date").eq("user_id", userId).gte("transaction_date", getBrazilDateStr(sixMonthsAgo));
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
      const thirtyDaysAgoStr = getBrazilDateStr(thirtyDaysAgo);

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

    // ONBOARDING TEMPLATE
    case "apply_onboarding_template": {
      const template = onboardingTemplates[args.template_type];
      if (!template) {
        return { error: `Template "${args.template_type}" não encontrado` };
      }

      const createdProjects: string[] = [];
      const createdHabits: string[] = [];

      // Create projects from template
      for (const project of template.projects) {
        const { data, error } = await supabaseAdmin.from("projects").insert({
          user_id: userId,
          title: project.title,
          description: project.description,
          status: "active",
          progress: 0
        }).select().single();
        if (!error && data) {
          createdProjects.push(project.title);
        }
      }

      // Create habits from template
      for (const habit of template.habits) {
        const { data, error } = await supabaseAdmin.from("habits").insert({
          user_id: userId,
          title: habit.title,
          frequency: habit.frequency,
          color: habit.color
        }).select().single();
        if (!error && data) {
          createdHabits.push(habit.title);
        }
      }

      // Create custom projects if provided
      if (args.custom_projects && Array.isArray(args.custom_projects)) {
        for (const projectTitle of args.custom_projects) {
          const { data, error } = await supabaseAdmin.from("projects").insert({
            user_id: userId,
            title: projectTitle,
            status: "active",
            progress: 0
          }).select().single();
          if (!error && data) {
            createdProjects.push(projectTitle);
          }
        }
      }

      // Create custom habits if provided
      if (args.custom_habits && Array.isArray(args.custom_habits)) {
        for (const habitTitle of args.custom_habits) {
          const { data, error } = await supabaseAdmin.from("habits").insert({
            user_id: userId,
            title: habitTitle,
            frequency: "daily",
            color: "#14B8A6"
          }).select().single();
          if (!error && data) {
            createdHabits.push(habitTitle);
          }
        }
      }

      return {
        success: true,
        template: template.name,
        projects: createdProjects,
        habits: createdHabits,
        message: `Template "${template.name}" aplicado! Criados ${createdProjects.length} projetos (${createdProjects.join(", ")}) e ${createdHabits.length} hábitos (${createdHabits.join(", ")}).`
      };
    }

    // WEEKLY REPORTS
    case "list_weekly_reports": {
      const limit = args.limit || 5;
      
      const { data, error } = await supabaseAdmin
        .from("messages")
        .select("id, content, created_at")
        .eq("user_id", userId)
        .eq("is_ai", true)
        .or("content.ilike.%Axiom Insights%,content.ilike.%Relatório Completo da Semana%")
        .order("created_at", { ascending: false })
        .limit(limit * 2); // Get more since we have pairs of messages

      if (error) throw error;

      if (!data?.length) {
        return { 
          success: true,
          reports: [],
          message: "Ainda não há relatórios semanais. Seu primeiro relatório será gerado na próxima segunda-feira às 6h, ou você pode pedir para gerar um agora."
        };
      }

      // Extract unique weeks from reports
      const reports = data
        .filter((m: any) => m.content.includes("Axiom Insights"))
        .slice(0, limit)
        .map((m: any) => {
          const weekMatch = m.content.match(/Semana\s+(\d{2}\/\d{2})\s+a\s+(\d{2}\/\d{2})/);
          const scoreMatch = m.content.match(/Score:\s*(\d+)\s*(📈|📉)\s*\(([+-]?\d+)\)/);
          return {
            id: m.id,
            week: weekMatch ? `${weekMatch[1]} - ${weekMatch[2]}` : "N/A",
            score: scoreMatch ? parseInt(scoreMatch[1]) : null,
            change: scoreMatch ? parseInt(scoreMatch[3]) : null,
            date: new Date(m.created_at).toLocaleDateString("pt-BR")
          };
        });

      return {
        success: true,
        reports,
        message: `Encontrados ${reports.length} relatórios semanais. ${reports.length > 0 ? `Último: semana de ${reports[0].week}, score ${reports[0].score}.` : ""}`
      };
    }

    case "generate_weekly_report": {
      // Trigger the generate-weekly-report edge function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-weekly-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
          },
          body: JSON.stringify({ user_id: userId })
        });

        const result = await response.json();
        
        if (result.success && result.generated > 0) {
          return {
            success: true,
            message: "Relatório semanal gerado! Ele aparecerá na conversa em instantes. Role para baixo para ver o Axiom Insights."
          };
        } else {
          return {
            success: false,
            message: "Não foi possível gerar o relatório no momento. Tente novamente em alguns minutos."
          };
        }
      } catch (e) {
        console.error("Error generating weekly report:", e);
        return {
          success: false,
          message: "Erro ao gerar relatório. Tente novamente mais tarde."
        };
      }
    }

    // CFO PESSOAL - FERRAMENTAS FINANCEIRAS AVANÇADAS
    case "predict_month_end": {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysRemaining = daysInMonth - now.getDate();
      
      // Get transactions from last 60 days for pattern analysis
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      const { data: recentTransactions } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .gte("transaction_date", getBrazilDateStr(sixtyDaysAgo));
      
      // Calculate average daily expense
      const expenses = recentTransactions?.filter((t: any) => t.type === "expense" && t.is_paid) || [];
      const totalExpenses = expenses.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
      const avgDailyExpense = totalExpenses / 60;
      
      // Get current month income and expenses
      const { data: currentMonthTransactions } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("reference_month", currentMonth);
      
      const monthIncome = currentMonthTransactions?.filter((t: any) => t.type === "income" && t.is_paid).reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      const monthExpensesPaid = currentMonthTransactions?.filter((t: any) => t.type === "expense" && t.is_paid).reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      // Get pending bills
      const { data: pendingBills } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_paid", false)
        .eq("type", "expense")
        .eq("reference_month", currentMonth);
      
      const totalPending = pendingBills?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      // Project remaining expenses
      const projectedRemainingExpenses = avgDailyExpense * daysRemaining;
      const totalProjectedExpenses = monthExpensesPaid + totalPending + projectedRemainingExpenses;
      const projectedBalance = monthIncome - totalProjectedExpenses;
      
      // Identify risks
      const risks: string[] = [];
      
      // Check for spending anomalies by category
      const categoryTotals: Record<string, number> = {};
      expenses.forEach((t: any) => {
        const cat = t.category || "Outros";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
      });
      
      const thisMonthCategories: Record<string, number> = {};
      currentMonthTransactions?.filter((t: any) => t.type === "expense").forEach((t: any) => {
        const cat = t.category || "Outros";
        thisMonthCategories[cat] = (thisMonthCategories[cat] || 0) + Number(t.amount);
      });
      
      // Find categories with significant increase
      Object.entries(thisMonthCategories).forEach(([cat, amount]) => {
        const avgMonthly = (categoryTotals[cat] || 0) / 2; // 60 days = ~2 months
        if (avgMonthly > 0 && amount > avgMonthly * 1.5) {
          const increase = Math.round(((amount - avgMonthly) / avgMonthly) * 100);
          risks.push(`${cat} aumentou ${increase}% (de R$${avgMonthly.toFixed(0)} para R$${amount.toFixed(0)})`);
        }
      });
      
      if (pendingBills && pendingBills.length > 0) {
        risks.push(`${pendingBills.length} boletos pendentes (R$${totalPending.toFixed(2)} total)`);
      }
      
      return {
        success: true,
        current_balance: monthIncome - monthExpensesPaid,
        month_income: monthIncome,
        month_expenses_paid: monthExpensesPaid,
        pending_bills: totalPending,
        days_remaining: daysRemaining,
        avg_daily_expense: Math.round(avgDailyExpense * 100) / 100,
        projected_remaining_expenses: Math.round(projectedRemainingExpenses),
        projected_end_balance: Math.round(projectedBalance),
        will_have_deficit: projectedBalance < 0,
        deficit_amount: projectedBalance < 0 ? Math.abs(Math.round(projectedBalance)) : 0,
        risks,
        message: projectedBalance < 0 
          ? `⚠️ Previsão: Déficit de R$${Math.abs(Math.round(projectedBalance))} no fim do mês. ${risks.length > 0 ? `Riscos: ${risks.slice(0, 2).join("; ")}` : ""}`
          : `✅ Previsão: Saldo de R$${Math.round(projectedBalance)} no fim do mês.`
      };
    }

    case "simulate_expense_cut": {
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("transaction_date", getBrazilDateStr(threeMonthsAgo));
      
      let itemsAnalyzed: Array<{ name: string; monthly_avg: number }> = [];
      let totalMonthlySavings = 0;
      
      // Search by specific items (titles)
      if (args.items && args.items.length > 0) {
        for (const item of args.items) {
          const matching = transactions?.filter((t: any) => 
            t.title.toLowerCase().includes(item.toLowerCase())
          ) || [];
          
          const total = matching.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
          const monthlyAvg = total / 3; // 3 months
          
          const reductionPercent = args.reduction_percent ?? 100;
          const savings = monthlyAvg * (reductionPercent / 100);
          
          itemsAnalyzed.push({ name: item, monthly_avg: Math.round(monthlyAvg) });
          totalMonthlySavings += savings;
        }
      }
      
      // Search by categories
      if (args.categories && args.categories.length > 0) {
        for (const category of args.categories) {
          const matching = transactions?.filter((t: any) => 
            t.category?.toLowerCase().includes(category.toLowerCase())
          ) || [];
          
          const total = matching.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
          const monthlyAvg = total / 3;
          
          const reductionPercent = args.reduction_percent ?? 100;
          const savings = monthlyAvg * (reductionPercent / 100);
          
          itemsAnalyzed.push({ name: category, monthly_avg: Math.round(monthlyAvg) });
          totalMonthlySavings += savings;
        }
      }
      
      totalMonthlySavings = Math.round(totalMonthlySavings);
      const yearlySavings = totalMonthlySavings * 12;
      
      // Generate projections
      const projections = [
        { months: 3, total_saved: totalMonthlySavings * 3 },
        { months: 6, total_saved: totalMonthlySavings * 6 },
        { months: 12, total_saved: yearlySavings }
      ];
      
      return {
        success: true,
        items_analyzed: itemsAnalyzed,
        reduction_percent: args.reduction_percent ?? 100,
        monthly_savings: totalMonthlySavings,
        yearly_savings: yearlySavings,
        projections,
        message: `💰 Cortando ${itemsAnalyzed.map(i => i.name).join(" + ")}: economia de R$${totalMonthlySavings}/mês = R$${yearlySavings}/ano!`
      };
    }

    case "analyze_spending_behavior": {
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("transaction_date", getBrazilDateStr(ninetyDaysAgo));
      
      const { data: scoreHistory } = await supabaseAdmin
        .from("axiom_score_history")
        .select("total_score, calculated_at")
        .eq("user_id", userId)
        .gte("calculated_at", ninetyDaysAgo.toISOString())
        .order("calculated_at", { ascending: false });
      
      const { data: habitLogs } = await supabaseAdmin
        .from("habit_logs")
        .select("completed_at")
        .eq("user_id", userId)
        .gte("completed_at", getBrazilDateStr(ninetyDaysAgo));
      
      // Analyze by day of week
      const dayOfWeekTotals: Record<number, { total: number; count: number }> = {};
      const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      
      transactions?.forEach((t: any) => {
        const date = new Date(t.transaction_date);
        const day = date.getDay();
        if (!dayOfWeekTotals[day]) dayOfWeekTotals[day] = { total: 0, count: 0 };
        dayOfWeekTotals[day].total += Number(t.amount);
        dayOfWeekTotals[day].count++;
      });
      
      // Find highest spending day
      let highestDay = 0;
      let highestAvg = 0;
      Object.entries(dayOfWeekTotals).forEach(([day, data]) => {
        const avg = data.total / data.count;
        if (avg > highestAvg) {
          highestAvg = avg;
          highestDay = parseInt(day);
        }
      });
      
      // Identify "invisible" small expenses
      const smallExpenses: Record<string, { total: number; count: number }> = {};
      transactions?.filter((t: any) => Number(t.amount) <= 30).forEach((t: any) => {
        const key = t.title.toLowerCase().slice(0, 20);
        if (!smallExpenses[key]) smallExpenses[key] = { total: 0, count: 0 };
        smallExpenses[key].total += Number(t.amount);
        smallExpenses[key].count++;
      });
      
      const invisibleExpenses = Object.entries(smallExpenses)
        .filter(([_, data]) => data.count >= 5)
        .map(([name, data]) => ({
          name,
          monthly_estimate: Math.round((data.total / 3)), // 3 months
          frequency: data.count
        }))
        .sort((a, b) => b.monthly_estimate - a.monthly_estimate)
        .slice(0, 5);
      
      const totalInvisible = invisibleExpenses.reduce((sum, e) => sum + e.monthly_estimate, 0);
      
      // Correlate with score (simplified)
      const avgScore = scoreHistory?.length 
        ? scoreHistory.reduce((sum: number, s: any) => sum + s.total_score, 0) / scoreHistory.length 
        : 0;
      
      // Correlate with habits
      const habitDays = new Set(habitLogs?.map((l: any) => l.completed_at) || []);
      
      return {
        success: true,
        invisible_expenses: {
          items: invisibleExpenses,
          total_monthly: totalInvisible,
          yearly_impact: totalInvisible * 12
        },
        timing_patterns: {
          highest_spending_day: dayNames[highestDay],
          average_on_highest: Math.round(highestAvg)
        },
        correlations: {
          avg_score: Math.round(avgScore),
          habit_consistency: `${habitDays.size}/90 dias ativos`
        },
        message: `🔍 Gastos invisíveis: R$${totalInvisible}/mês (R$${totalInvisible * 12}/ano). Dia mais caro: ${dayNames[highestDay]}. ${invisibleExpenses.length > 0 ? `Maiores: ${invisibleExpenses.slice(0, 2).map(e => e.name).join(", ")}` : ""}`
      };
    }

    case "get_expenses_by_category": {
      const now = new Date();
      let startDate: Date;
      
      switch (args.period) {
        case "week":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "quarter":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        default: // month
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("transaction_date", getBrazilDateStr(startDate));
      
      // If specific category requested
      if (args.category) {
        const categoryTransactions = transactions?.filter((t: any) => 
          t.category?.toLowerCase().includes(args.category.toLowerCase())
        ) || [];
        
        const total = categoryTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        
        // Group by title for subcategory breakdown
        const byTitle: Record<string, number> = {};
        categoryTransactions.forEach((t: any) => {
          byTitle[t.title] = (byTitle[t.title] || 0) + Number(t.amount);
        });
        
        const breakdown = Object.entries(byTitle)
          .map(([name, amount]) => ({
            subcategory: name,
            amount: Math.round(amount),
            percentage: Math.round((amount / total) * 100)
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10);
        
        return {
          success: true,
          category: args.category,
          total: Math.round(total),
          breakdown,
          period: args.period || "month",
          message: `💸 ${args.category}: R$${Math.round(total)} no período. ${breakdown.length > 0 ? `Maiores: ${breakdown.slice(0, 3).map(b => `${b.subcategory} (R$${b.amount})`).join(", ")}` : ""}`
        };
      }
      
      // All categories breakdown
      const byCategory: Record<string, number> = {};
      transactions?.forEach((t: any) => {
        const cat = t.category || "Outros";
        byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount);
      });
      
      const total = transactions?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      const breakdown = Object.entries(byCategory)
        .map(([category, amount]) => ({
          category,
          amount: Math.round(amount),
          percentage: Math.round((amount / total) * 100)
        }))
        .sort((a, b) => b.amount - a.amount);
      
      return {
        success: true,
        total: Math.round(total),
        breakdown,
        period: args.period || "month",
        top_category: breakdown[0]?.category || "N/A",
        message: `📊 Total de despesas: R$${Math.round(total)}. Maior categoria: ${breakdown[0]?.category} (${breakdown[0]?.percentage}%)`
      };
    }

    case "create_financial_goal": {
      const monthlyTarget = args.deadline_months ? args.target_amount / args.deadline_months : null;
      
      // Get current monthly surplus
      const now = new Date();
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      
      const { data: transactions } = await supabaseAdmin
        .from("transactions")
        .select("amount, type, is_paid")
        .eq("user_id", userId)
        .eq("is_paid", true)
        .gte("transaction_date", getBrazilDateStr(threeMonthsAgo));
      
      const income = transactions?.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      const expenses = transactions?.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      const avgMonthlySurplus = (income - expenses) / 3;
      
      // Generate action plan
      const actionPlan: string[] = [];
      let achievableSavings = avgMonthlySurplus;
      
      if (monthlyTarget && avgMonthlySurplus < monthlyTarget) {
        const gap = monthlyTarget - avgMonthlySurplus;
        actionPlan.push(`Você precisa de +R$${Math.round(gap)}/mês além da sobra atual`);
        
        // Suggest cutting common categories
        const { data: categoryExpenses } = await supabaseAdmin
          .from("transactions")
          .select("category, amount")
          .eq("user_id", userId)
          .eq("type", "expense")
          .gte("transaction_date", threeMonthsAgo.toISOString().split("T")[0]);
        
        const byCategory: Record<string, number> = {};
        categoryExpenses?.forEach((t: any) => {
          byCategory[t.category || "Outros"] = (byCategory[t.category || "Outros"] || 0) + Number(t.amount);
        });
        
        const sortedCategories = Object.entries(byCategory)
          .map(([cat, total]) => ({ cat, monthly: total / 3 }))
          .sort((a, b) => b.monthly - a.monthly);
        
        const discretionaryCategories = ["Delivery", "Entretenimento", "Assinaturas", "Lazer", "Restaurantes"];
        const cuttable = sortedCategories.filter(c => 
          discretionaryCategories.some(d => c.cat.toLowerCase().includes(d.toLowerCase()))
        );
        
        if (cuttable.length > 0) {
          const suggestion = cuttable[0];
          const potentialSaving = Math.round(suggestion.monthly * 0.5);
          actionPlan.push(`Reduzir ${suggestion.cat} em 50%: +R$${potentialSaving}/mês`);
          achievableSavings += potentialSaving;
        }
      }
      
      const deadline = args.deadline_months 
        ? new Date(now.setMonth(now.getMonth() + args.deadline_months))
        : null;
      
      const { data, error } = await supabaseAdmin.from("financial_goals").insert({
        user_id: userId,
        title: args.title,
        target_amount: args.target_amount,
        deadline: deadline?.toISOString().split("T")[0] || null,
        action_plan: actionPlan
      }).select().single();
      
      if (error) throw error;
      
      const feasibility = monthlyTarget && achievableSavings >= monthlyTarget 
        ? "Viável com sua sobra atual" 
        : monthlyTarget && achievableSavings >= monthlyTarget * 0.7
        ? "Viável com pequenos ajustes"
        : "Exige mudanças significativas";
      
      return {
        success: true,
        goal: data,
        monthly_target: monthlyTarget ? Math.round(monthlyTarget) : null,
        current_surplus: Math.round(avgMonthlySurplus),
        gap: monthlyTarget ? Math.round(monthlyTarget - avgMonthlySurplus) : null,
        action_plan: actionPlan,
        feasibility,
        message: `🎯 Meta "${args.title}" criada! Alvo: R$${args.target_amount}${args.deadline_months ? ` em ${args.deadline_months} meses (R$${Math.round(monthlyTarget!)}/mês)` : ""}. ${feasibility}.`
      };
    }

    case "track_financial_goal": {
      const { data: goal, error } = await supabaseAdmin
        .from("financial_goals")
        .select("*")
        .eq("id", args.goal_id)
        .eq("user_id", userId)
        .single();
      
      if (error || !goal) {
        return { success: false, message: "Meta não encontrada. Use list_financial_goals primeiro para ver as metas disponíveis." };
      }
      
      const percentComplete = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
      const remaining = Number(goal.target_amount) - Number(goal.current_amount);
      
      let daysRemaining = null;
      let monthsRemaining = null;
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        const now = new Date();
        daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        monthsRemaining = Math.ceil(daysRemaining / 30);
      }
      
      return {
        success: true,
        goal: {
          title: goal.title,
          target: Number(goal.target_amount),
          current: Number(goal.current_amount),
          remaining,
          percent_complete: percentComplete,
          deadline: goal.deadline,
          days_remaining: daysRemaining,
          months_remaining: monthsRemaining,
          status: goal.status
        },
        monthly_needed: monthsRemaining && monthsRemaining > 0 ? Math.round(remaining / monthsRemaining) : null,
        action_plan: goal.action_plan,
        message: `📈 "${goal.title}": R$${Number(goal.current_amount).toFixed(0)}/${Number(goal.target_amount).toFixed(0)} (${percentComplete}%). Faltam R$${remaining.toFixed(0)}${monthsRemaining ? ` em ${monthsRemaining} meses` : ""}.`
      };
    }

    case "list_financial_goals": {
      const { data, error } = await supabaseAdmin
        .from("financial_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      const goalsWithProgress = data?.map((g: any) => ({
        ...g,
        percent_complete: Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)
      })) || [];
      
      return {
        success: true,
        goals: goalsWithProgress,
        message: `${goalsWithProgress.length} metas financeiras encontradas. Use os IDs para acompanhar progresso.`
      };
    }

    case "update_financial_goal": {
      const updateData: any = {};
      if (args.title) updateData.title = args.title;
      if (args.target_amount !== undefined) updateData.target_amount = args.target_amount;
      if (args.current_amount !== undefined) updateData.current_amount = args.current_amount;
      if (args.deadline) updateData.deadline = args.deadline;
      if (args.status) updateData.status = args.status;

      const { data, error } = await supabaseAdmin
        .from("financial_goals")
        .update(updateData)
        .eq("id", args.id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;

      const percentComplete = Math.round((Number(data.current_amount) / Number(data.target_amount)) * 100);
      return {
        success: true,
        goal: { ...data, percent_complete: percentComplete },
        message: `Meta "${data.title}" atualizada! ${percentComplete}% do objetivo alcançado.`
      };
    }

    case "delete_financial_goal": {
      const { data: goal } = await supabaseAdmin
        .from("financial_goals")
        .select("title")
        .eq("id", args.id)
        .eq("user_id", userId)
        .single();

      const { error } = await supabaseAdmin
        .from("financial_goals")
        .delete()
        .eq("id", args.id)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true, message: `Meta "${goal?.title || "financeira"}" excluída com sucesso!` };
    }

    case "suggest_transaction_category": {
      // Get user's transaction history to learn patterns
      const { data: history } = await supabaseAdmin
        .from("transactions")
        .select("title, category, amount")
        .eq("user_id", userId)
        .eq("type", "expense")
        .order("created_at", { ascending: false })
        .limit(100);
      
      // Find similar amounts
      const amountRange = args.amount * 0.3; // 30% tolerance
      const similarByAmount = history?.filter((t: any) => 
        Math.abs(Number(t.amount) - args.amount) <= amountRange
      ) || [];
      
      // Count categories
      const categoryCounts: Record<string, number> = {};
      similarByAmount.forEach((t: any) => {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      });
      
      // Also check description if provided
      if (args.description) {
        const similarByTitle = history?.filter((t: any) =>
          t.title.toLowerCase().includes(args.description.toLowerCase()) ||
          args.description.toLowerCase().includes(t.title.toLowerCase())
        ) || [];
        
        similarByTitle.forEach((t: any) => {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 2; // Weight title matches higher
        });
      }
      
      // Sort by frequency
      const suggestions = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          category,
          confidence: Math.min(Math.round((count / Math.max(similarByAmount.length, 1)) * 100), 95)
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
      
      // Default suggestions if no history
      if (suggestions.length === 0) {
        if (args.amount <= 30) suggestions.push({ category: "Alimentação", confidence: 60 });
        else if (args.amount <= 100) suggestions.push({ category: "Transporte", confidence: 50 });
        else suggestions.push({ category: "Compras", confidence: 40 });
      }
      
      return {
        success: true,
        suggestions,
        reasoning: `Baseado em ${similarByAmount.length} transações similares no seu histórico`,
        message: `🤔 Chuto: ${suggestions[0]?.category} (${suggestions[0]?.confidence}% de chance). Certo?`
      };
    }

    case "get_upcoming_bills": {
      const days = args.days || 7;
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + days);
      
      const { data: upcoming } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_paid", false)
        .eq("type", "expense")
        .gte("transaction_date", now.toISOString().split("T")[0])
        .lte("transaction_date", futureDate.toISOString().split("T")[0])
        .order("transaction_date", { ascending: true });
      
      const total = upcoming?.reduce((sum: number, t: any) => sum + Number(t.amount), 0) || 0;
      
      // Get current balance from accounts
      const { data: accounts } = await supabaseAdmin
        .from("accounts")
        .select("balance")
        .eq("user_id", userId);
      
      const currentBalance = accounts?.reduce((sum: number, a: any) => sum + Number(a.balance), 0) || 0;
      const willCover = currentBalance >= total;
      
      const bills = upcoming?.map((t: any) => {
        const dueDate = new Date(t.transaction_date);
        const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          title: t.title,
          amount: Number(t.amount),
          due_date: t.transaction_date,
          days_until: daysUntil,
          category: t.category
        };
      }) || [];
      
      const riskLevel = !willCover ? "high" : total > currentBalance * 0.8 ? "medium" : "low";
      
      return {
        success: true,
        upcoming: bills,
        total: Math.round(total),
        current_balance: Math.round(currentBalance),
        will_cover: willCover,
        shortfall: willCover ? 0 : Math.round(total - currentBalance),
        risk_level: riskLevel,
        message: bills.length > 0 
          ? `📅 ${bills.length} contas vencendo em ${days} dias: R$${Math.round(total)} total. ${willCover ? "✅ Saldo suficiente." : `⚠️ Faltam R$${Math.round(total - currentBalance)}!`}`
          : `✅ Nenhuma conta vencendo nos próximos ${days} dias.`
      };
    }

    // MEMORY SYSTEM TOOLS
    case "search_memories": {
      const limit = args.limit || 5;
      
      let query = supabaseAdmin
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null);

      if (args.types && args.types.length > 0) {
        query = query.in("type", args.types);
      }

      if (args.query) {
        query = query.ilike("content", `%${args.query}%`);
      }

      const { data: memories, error } = await query
        .order("usage_count", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Update usage count for found memories
      if (memories && memories.length > 0) {
        for (const mem of memories) {
          await supabaseAdmin
            .from("memories")
            .update({ 
              usage_count: (mem.usage_count || 0) + 1,
              last_used_at: new Date().toISOString()
            })
            .eq("id", mem.id);
        }
      }

      return { 
        success: true, 
        memories: memories?.map((m: any) => ({
          id: m.id,
          type: m.type,
          content: m.content,
          topics: m.context?.topics || [],
          confidence: m.context?.confidence || 3,
          usage_count: m.usage_count
        })) || [],
        message: memories && memories.length > 0 
          ? `🧠 Encontrei ${memories.length} memória(s) relevante(s)` 
          : "Nenhuma memória encontrada para essa busca"
      };
    }

    case "save_memory": {
      // Check for duplicates
      const { data: existing } = await supabaseAdmin
        .from("memories")
        .select("id, content")
        .eq("user_id", userId)
        .eq("type", args.type)
        .is("archived_at", null)
        .limit(50);

      const isDuplicate = existing?.some((e: any) => 
        e.content.toLowerCase().includes(args.content.toLowerCase().substring(0, 30)) ||
        args.content.toLowerCase().includes(e.content.toLowerCase().substring(0, 30))
      );

      if (isDuplicate) {
        return { 
          success: false, 
          message: "Esta memória já existe ou é muito similar a uma existente" 
        };
      }

      const { data: memory, error } = await supabaseAdmin
        .from("memories")
        .insert({
          user_id: userId,
          type: args.type,
          content: args.content,
          context: {
            topics: args.topics || [],
            relatedMemories: [],
            confidence: args.confidence || 3
          }
        })
        .select()
        .single();

      if (error) throw error;

      return { 
        success: true, 
        memory: {
          id: memory.id,
          type: memory.type,
          content: memory.content
        },
        message: `🧠 Memória salva: "${args.content.substring(0, 50)}..."`
      };
    }

    case "list_learning_insights": {
      let query = supabaseAdmin
        .from("memories")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null);

      if (args.type) {
        query = query.eq("type", args.type);
      }

      const { data: memories, error } = await query
        .order("type")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by type
      const grouped: Record<string, any[]> = {};
      memories?.forEach((m: any) => {
        if (!grouped[m.type]) grouped[m.type] = [];
        grouped[m.type].push({
          id: m.id,
          content: m.content,
          topics: m.context?.topics || [],
          confidence: m.context?.confidence || 3
        });
      });

      const typeLabels: Record<string, string> = {
        personality: "🎭 Personalidade",
        routine: "📅 Rotinas",
        goal: "🎯 Metas",
        pattern: "📊 Padrões",
        preference: "⚡ Preferências",
        fact: "📌 Fatos",
        insight: "💡 Insights"
      };

      return { 
        success: true, 
        insights: grouped,
        total: memories?.length || 0,
        summary: Object.entries(grouped).map(([type, mems]) => 
          `${typeLabels[type] || type}: ${mems.length} memória(s)`
        ).join(", "),
        message: memories && memories.length > 0 
          ? `🧠 Total de ${memories.length} memória(s) em ${Object.keys(grouped).length} categoria(s)` 
          : "Ainda não aprendi nada sobre você. Vamos conversar!"
      };
    }

    case "archive_memory": {
      const { error } = await supabaseAdmin
        .from("memories")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", args.memory_id)
        .eq("user_id", userId);

      if (error) throw error;

      return { 
        success: true, 
        message: "🗑️ Memória arquivada com sucesso"
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
    // Validate input
    const body = await req.json();
    const parseResult = ChatRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error("Validation error:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: "Dados de entrada inválidos",
          details: parseResult.error.errors.map(e => e.message)
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { messages } = parseResult.data;
    const zaiApiKey = Deno.env.get("ZAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!zaiApiKey) {
      throw new Error("ZAI_API_KEY não configurada");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error("Usuário não autenticado");

    // Rate limiting check
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.warn(`[RateLimit] User ${user.id} exceeded rate limit. Reset in ${Math.ceil(rateLimit.resetIn / 1000)}s`);
      return new Response(
        JSON.stringify({ 
          error: "Limite de requisições excedido. Aguarde um momento antes de enviar mais mensagens.",
          resetIn: Math.ceil(rateLimit.resetIn / 1000)
        }), 
        {
          status: 429,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000))
          }
        }
      );
    }
    console.log(`[RateLimit] User ${user.id}: ${rateLimit.remaining} requests remaining`);

// Buscar nome, contexto e modo de personalidade do usuário
    const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, user_context, personality_mode").eq("id", user.id).maybeSingle();
    const userName = profile?.full_name || user.email?.split("@")[0] || "Usuário";
    const userContext = profile?.user_context || null;
    const personalityMode = profile?.personality_mode || "direto";

    // Create or update conversation record
    let conversationId: string | null = null;
    try {
      // Extract topics from the last user message
      const lastUserMessage = messages.filter((m: any) => m.role === "user").pop();
      const messageContent = lastUserMessage?.content || "";
      
      // Extract simple keywords as topics (first 5 significant words)
      const topics = messageContent
        .toLowerCase()
        .replace(/[^\w\sàáâãéêíóôõúç]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3)
        .slice(0, 5);

      // Generate a title from the first user message if this is a new conversation
      const firstUserMessage = messages.find((m: any) => m.role === "user")?.content || "Nova conversa";
      const title = firstUserMessage.substring(0, 100) + (firstUserMessage.length > 100 ? "..." : "");

      // Check if there's an existing recent conversation (within last 30 minutes)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id, message_count, context_topics")
        .eq("user_id", user.id)
        .gte("updated_at", thirtyMinutesAgo)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        // Update existing conversation
        const existingTopics = existingConv.context_topics || [];
        const mergedTopics = [...new Set([...existingTopics, ...topics])].slice(0, 10);
        
        await supabaseAdmin
          .from("conversations")
          .update({
            message_count: (existingConv.message_count || 0) + 1,
            context_topics: mergedTopics,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingConv.id);
        
        conversationId = existingConv.id;
        console.log(`[Conversation] Updated existing: ${conversationId}`);
      } else {
        // Create new conversation
        const { data: newConv, error: convError } = await supabaseAdmin
          .from("conversations")
          .insert({
            user_id: user.id,
            title,
            context_topics: topics,
            message_count: 1
          })
          .select("id")
          .single();

        if (!convError && newConv) {
          conversationId = newConv.id;
          console.log(`[Conversation] Created new: ${conversationId}`);
        }
      }
    } catch (convErr) {
      console.error("[Conversation] Tracking error:", convErr);
      // Don't fail the request if conversation tracking fails
    }

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

    // ===== CONTEXTO TEMPORAL DINÂMICO =====
    const now = new Date();
    // Ajustar para horário de Brasília (UTC-3)
    const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const diaSemana = diasSemana[brazilTime.getDay()];
    const dia = brazilTime.getDate();
    const mes = meses[brazilTime.getMonth()];
    const ano = brazilTime.getFullYear();
    const mesNum = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const diaNum = String(dia).padStart(2, '0');
    
    // Calcular ontem
    const ontem = new Date(brazilTime);
    ontem.setDate(ontem.getDate() - 1);
    const ontemDia = String(ontem.getDate()).padStart(2, '0');
    const ontemMes = String(ontem.getMonth() + 1).padStart(2, '0');
    const ontemAno = ontem.getFullYear();
    
    // Calcular anteontem
    const anteontem = new Date(brazilTime);
    anteontem.setDate(anteontem.getDate() - 2);
    const anteontemDia = String(anteontem.getDate()).padStart(2, '0');
    const anteontemMes = String(anteontem.getMonth() + 1).padStart(2, '0');
    const anteontemAno = anteontem.getFullYear();
    
    const temporalContext = `📅 CALENDÁRIO E DATA ATUAL (CRÍTICO - USE SEMPRE PARA DATAS):
HOJE: ${diaSemana}, ${dia} de ${mes} de ${ano}
DATA HOJE (YYYY-MM-DD): ${ano}-${mesNum}-${diaNum}
ONTEM: ${ontem.getDate()} de ${meses[ontem.getMonth()]} → ${ontemAno}-${ontemMes}-${ontemDia}
ANTEONTEM: ${anteontem.getDate()} de ${meses[anteontem.getMonth()]} → ${anteontemAno}-${anteontemMes}-${anteontemDia}
MÊS ATUAL: ${mes} (${mesNum}/${ano})

⚠️ REGRAS OBRIGATÓRIAS PARA transaction_date (CRÍTICO - NUNCA OMITA!):
1. SEMPRE envie transaction_date em TODAS as transações - É UM CAMPO OBRIGATÓRIO!
2. "hoje" ou "agora" ou SEM MENÇÃO DE DATA → use ${ano}-${mesNum}-${diaNum}
3. "ontem" → use ${ontemAno}-${ontemMes}-${ontemDia}
4. "anteontem" → use ${anteontemAno}-${anteontemMes}-${anteontemDia}
5. "dia X" (sem mês) → assume mês atual: ${ano}-${mesNum}-[X com 2 dígitos]
6. "dia X de [mês]" → use o mês especificado com ano atual
7. NUNCA deixe transaction_date em branco/null/undefined - O SISTEMA REQUER!
8. SEMPRE use formato YYYY-MM-DD (ex: ${ano}-${mesNum}-${diaNum})

EXEMPLO: Se usuário disser apenas "gastei 50 no almoço" sem mencionar data:
→ transaction_date: "${ano}-${mesNum}-${diaNum}" (usa HOJE automaticamente)`;


    const systemPrompt = `Você é Axiom, Consultor Estratégico Pessoal do(a) ${userName}.

${temporalContext}

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

💰 CFO PESSOAL (CONSULTOR FINANCEIRO VIA CHAT):
Você é o CFO Pessoal do ${userName}. Ajude a dominar finanças via conversa natural.

REGISTRO DE TRANSAÇÕES:
- Quando disser "gastei R$X em Y" → use create_transaction
- Se não informar categoria → use suggest_transaction_category para deduzir
- Sempre confirme o registro com saldo disponível

CONSULTAS:
- "Quanto gastei em X?" → use get_expenses_by_category com a categoria específica
- "Saldo?" ou "resumo?" → use get_finance_summary
- "Transações pendentes?" → use list_pending_transactions
- "Contas a pagar?" ou "Boletos vencendo?" → use get_upcoming_bills

ANÁLISES AVANÇADAS:
- "Vou ter dinheiro no fim do mês?" ou "Previsão?" → use predict_month_end
- "Por que meu dinheiro some?" ou "Padrões de gasto?" → use analyze_spending_behavior
- "Se eu cortar X, quanto economizo?" → use simulate_expense_cut

METAS FINANCEIRAS:
- "Quero juntar R$X" ou "Meta de economia" → use create_financial_goal (gera plano de ação)
- "Como está minha meta?" → use list_financial_goals + track_financial_goal
- Sempre relacione metas com ações práticas e hábitos

CATEGORIZAÇÃO INTELIGENTE:
- Se usuário disser "gastei R$X" sem especificar categoria → use suggest_transaction_category
- Confirme a sugestão: "Chuto Alimentação. Certo?"
- Se errar, aprenda para próximas vezes

ESTILO DE RESPOSTA FINANCEIRA:
- Use emojis para tornar dados mais digeríveis (💰💸🎯📊📉📈)
- SEMPRE contextualize números: "R$420 em delivery = 35% do orçamento de alimentação"
- Faça correlações comportamentais: "Delivery sobe quando você não exercita"
- Termine com pergunta estratégica ou sugestão de ação

📋 CATEGORIAS PERMITIDAS (USE EXATAMENTE ESTAS):
DESPESAS: Alimentação, Mercado, Transporte, Moradia, Saúde, Saúde/Suplementos, Farmácia, Educação, Lazer, Compras, Eletrônicos, Assinaturas, Assinaturas/Software, Casa/Escritório, Cuidados pessoais, Pet, Telefonia, Investimentos, Poupança/Reserva de Emergência, Dívidas/Empréstimos, Impostos/Tributos, Presentes/Doações, Doações/Dízimo, Transferência, Outros

RECEITAS: Salário, Salário/Remuneração, Freelance, Investimentos, Vendas, Empréstimos/Recebimentos, Transferência, Outros

IMPORTANTE: Use EXATAMENTE essas categorias ao criar transações. Escolha a mais apropriada da lista. Não invente novas categorias!

💳 REGRAS PARA PARCELAS (CRÍTICO - SIGA EXATAMENTE):
Quando o usuário mencionar "parcelado", "em X vezes", "Xx" (ex: 10x, 3x, 12x):
- Use is_installment: true
- Use total_installments: [número de parcelas]
- O AMOUNT é o valor DE CADA PARCELA, não o valor total
- O payment_method geralmente é "Crédito" para parcelas
- SEMPRE inclua transaction_date da primeira parcela!

⚠️ INTERPRETAÇÃO DO VALOR EM PARCELAS (MUITO IMPORTANTE):
Padrão 1: "Comprei X em Nx" (valor + parcelas) → PERGUNTE se X é total ou por parcela!
Padrão 2: "Parcelei em Nx de Y" (parcelas + valor explícito) → amount = Y (já é por parcela)
Padrão 3: "Gastei X total em Nx" (menciona "total") → amount = X/N (divida)

EXEMPLOS CORRETOS:
- "Comprei uma TV de 500 reais em 10x"
  → AMBÍGUO! Pergunte: "Os R$500 são o valor total ou de cada parcela?"
  → Se total: amount: 50 (500/10), total_installments: 10
  → Se cada parcela: amount: 500, total_installments: 10

- "Parcelei o celular em 12 vezes de 150"
  → amount: 150 (valor explícito por parcela), total_installments: 12

- "Gastei 800 total em 4x no cartão"
  → amount: 200 (800/4), total_installments: 4

REGRA DE OURO: Na dúvida entre valor total ou por parcela, PERGUNTE ao usuário!

⚠️ REGRA CRÍTICA PARA PAGAMENTOS (SIGA SEMPRE!):
- Para MARCAR transação como PAGA → use APENAS pay_transaction
- Para DESMARCAR transação como paga → use APENAS unpay_transaction  
- NUNCA use update_transaction para mudar is_paid! As funções pay/unpay são atômicas e garantem sincronização do saldo.
- update_transaction é APENAS para: título, valor, categoria, data, método de pagamento, conta vinculada
- Se usou update_transaction erroneamente para is_paid, o sistema irá redirecionar automaticamente para as funções atômicas

🔄 CORREÇÕES DE TRANSAÇÕES (CRÍTICO - DETECTE E CORRIJA!):
Quando o usuário disser frases como:
- "na verdade foram X", "errei, eram X", "não era X, era Y", "corrige para X", "na real foram X"
Isso indica CORREÇÃO de uma transação recente, NÃO criação de nova!

FLUXO OBRIGATÓRIO PARA CORREÇÕES:
1. PRIMEIRO: chame list_transactions para encontrar a transação recente relacionada
2. Identifique pelo título/categoria/data semelhante ao contexto anterior
3. Use update_transaction para corrigir o valor (ou outro campo)
4. NUNCA crie nova transação quando for correção!

EXEMPLO:
User: "paguei 50 de uber"
→ [cria transação: Uber R$50]
User: "na verdade foram 60"
→ list_transactions → encontra "Uber" recente → update_transaction(id, amount: 60)
→ Resposta: "Corrigido! Uber atualizado de R$50 para R$60 ✅"

📦 MÚLTIPLAS TRANSAÇÕES (LOTE):
Quando usuário listar vários itens (ex: "comprei pão 10, leite 5 e café 15"):
- Use create_batch_transactions para criar todas de uma vez
- Se disser "paguei" ou "gastei", use is_paid: true
- Se mencionar conta (ex: "no Nubank"), use account_id
- Mais eficiente e garante consistência de data/tipo/conta

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

🎬 ONBOARDING DE NOVOS USUÁRIOS:
Quando o usuário escolher um perfil no início da conversa:

- "Empreendedor Solo" → use apply_onboarding_template com template_type: "empreendedor"
  Cria: 4 projetos (Produto, Marketing, Vendas, Financeiro) + 3 hábitos (Deep Work, Networking, Exercício)

- "Executivo Corporativo" → use apply_onboarding_template com template_type: "executivo"
  Cria: 3 projetos (OKRs, Time, Stakeholders) + 3 hábitos (1:1, Leitura, Autocuidado)

- "Freelancer Criativo" → use apply_onboarding_template com template_type: "freelancer"
  Cria: 3 projetos (Clientes, Portfólio, Prospecção) + 3 hábitos (Criativo, Admin, Aprendizado)

- "Profissional de Vendas" → use apply_onboarding_template com template_type: "vendas"
  Cria: 3 projetos (Pipeline, Comissões, Eventos) + 3 hábitos (Prospecção, Follow-up, Estudo)

- "Quero criar minha configuração personalizada" → NÃO use template, guie passo a passo:
  1. Pergunte: "Quais são os 2-4 principais projetos ou áreas que você quer organizar?"
  2. Depois: "E quais hábitos você quer construir? (diários ou semanais)"
  3. Crie cada um usando create_project e create_habit individualmente

Após aplicar o template:
- Confirme de forma entusiasmada o que foi criado
- Pergunte se quer ajustar algo (adicionar/remover)
- Se pedirem ajustes como "adiciona meditação nos hábitos" → use create_habit

Responda SEMPRE em português brasileiro. Seja conciso mas impactante. Não seja genérico - seja específico e direcionado.`;

    console.log(`Processing chat for user: ${userName} (${user.id}) with model: glm-4.7 (z.ai)`);

    // ========== NON-STREAMING PARA TOOL CALLS ==========
    // A z.ai fragmenta JSON de tool_calls de forma imprevisível.
    // Solução: usar stream: false para detectar/executar tools,
    // e stream: true apenas para a resposta final de texto.
    
    let executedActions: string[] = [];
    let currentMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...messages
    ];
    
    // Limite de segurança para loops de ferramentas
    const MAX_TOOL_ITERATIONS = 10;
    let iteration = 0;
    
    // Loop de processamento de tool calls (non-streaming)
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;
      console.log(`[z.ai] Iteration ${iteration}: Making non-streaming request...`);
      
      const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${zaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "glm-4.7",
          messages: currentMessages,
          tools,
          tool_choice: "auto",
          stream: false  // NON-STREAMING para parsing confiável
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[z.ai] API error:", errorText);
        throw new Error(`z.ai API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason;
      const message = choice?.message;
      
      console.log(`[z.ai] Iteration ${iteration}: finish_reason=${finishReason}, has_tool_calls=${!!message?.tool_calls?.length}`);
      
      // Se não há tool_calls, sair do loop e fazer streaming da resposta
      if (finishReason !== "tool_calls" || !message?.tool_calls?.length) {
        console.log(`[z.ai] No more tool calls, preparing final streaming response...`);
        
        // Se já temos conteúdo de texto, usá-lo diretamente
        if (message?.content) {
          console.log(`[z.ai] Using non-streamed content from last response`);
          
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              // Enviar o conteúdo de texto
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: message.content })}\n\n`));
              
              // Enviar ações executadas
              if (executedActions.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ actions: executedActions })}\n\n`));
              }
              
              // Trigger memory extraction
              if (messages && messages.length >= 4) {
                const recentMessages = messages.slice(-8);
                console.log(`[Memory] Triggering extract-memories for user ${user.id}`);
                
                fetch(`${supabaseUrl}/functions/v1/extract-memories`, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    userId: user.id,
                    conversationId: conversationId,
                    messages: recentMessages
                  })
                }).catch(err => console.error("[Memory] Extract error:", err));
              }
              
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
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
        }
        
        // Caso contrário, fazer chamada final com streaming
        break;
      }
      
      // Processar tool_calls
      const toolCalls = message.tool_calls;
      console.log(`[z.ai] Tool calls received: ${toolCalls.map((tc: any) => tc.function?.name).join(", ")}`);
      
      const toolResults: any[] = [];
      for (const tc of toolCalls) {
        try {
          const funcName = tc.function?.name;
          const funcArgs = JSON.parse(tc.function?.arguments || "{}");
          console.log(`[z.ai] Executing tool: ${funcName}`, JSON.stringify(funcArgs).substring(0, 200));
          
          const result = await executeTool(supabaseAdmin, user.id, funcName, funcArgs);
          console.log(`[z.ai] Tool result for ${funcName}:`, JSON.stringify(result).substring(0, 300));
          
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify(result)
          });
          
          if (result.success) {
            executedActions.push(funcName);
          }
        } catch (e) {
          console.error(`[z.ai] Tool execution error for ${tc.function?.name}:`, e);
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify({ error: String(e) })
          });
        }
      }
      
      // Adicionar a mensagem do assistente com tool_calls e os resultados
      currentMessages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls.map((tc: any) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function?.name,
            arguments: tc.function?.arguments
          }
        }))
      });
      currentMessages.push(...toolResults);
      
      console.log(`[z.ai] Added tool results to context, continuing loop...`);
    }
    
    if (iteration >= MAX_TOOL_ITERATIONS) {
      console.warn("[z.ai] Max tool iterations reached!");
    }
    
    // ========== CHAMADA FINAL COM STREAMING ==========
    // Após processar todas as tools, fazer streaming da resposta final
    console.log(`[z.ai] Making final streaming request after ${iteration} tool iteration(s)...`);
    
    const finalResponse = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${zaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "glm-4.7",
        messages: currentMessages,
        stream: true  // STREAMING para resposta final
        // SEM tools - já foram processadas
      })
    });

    if (!finalResponse.ok) {
      const errorText = await finalResponse.text();
      console.error("[z.ai] Final response error:", errorText);
      throw new Error(`z.ai API error: ${finalResponse.status}`);
    }

    const reader = finalResponse.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            let newlineIndex: number;
            
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              
              if (!line || line.startsWith(':')) continue;
              if (!line.startsWith("data: ")) continue;
              
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta.content })}\n\n`));
                }
              } catch {
                // JSON incompleto - fragmento será acumulado no próximo chunk
              }
            }
          }

          if (executedActions.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ actions: executedActions })}\n\n`));
          }

          // Trigger automatic memory extraction in background (non-blocking)
          if (messages && messages.length >= 4) {
            const recentMessages = messages.slice(-8);
            
            console.log(`[Memory] Triggering extract-memories for user ${user.id} with ${recentMessages.length} messages`);
            
            fetch(`${supabaseUrl}/functions/v1/extract-memories`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${supabaseServiceKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                userId: user.id,
                conversationId: conversationId,
                messages: recentMessages
              })
            }).then(res => {
              if (res.ok) {
                res.json().then(data => {
                  console.log(`[Memory] Extracted ${data.memories_created || 0} memories for user ${user.id}`);
                });
              } else {
                console.error(`[Memory] Extract failed with status ${res.status}`);
              }
            }).catch(err => {
              console.error("[Memory] Extract error:", err);
            });
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
