
# 🎯 Correção: Axiom Não Entende "Última Semana" Corretamente

## Problema Identificado

Quando você perguntou "quanto eu gastei nesta última semana?", o Axiom trouxe dados de outros períodos porque as ferramentas financeiras não têm suporte adequado para filtragem por período temporal.

### Análise Técnica

| Ferramenta | Parâmetros de Data | Status |
|------------|-------------------|--------|
| `list_transactions` | Nenhum | ❌ Problema |
| `get_finance_summary` | Hardcoded para mês atual | ❌ Problema |
| `get_expenses_by_category` | `period: "week"` | ✅ Existe mas não usado |

### O que falta no sistema:

1. Parâmetros `start_date` e `end_date` nas ferramentas financeiras
2. Contexto temporal expandido (datas calculadas para semana, mês passado, etc.)
3. Instruções explícitas de qual ferramenta usar para cada período

---

## Solução Proposta

### 1. Expandir Contexto Temporal no System Prompt

Adicionar cálculos de datas úteis:

```text
📅 DATAS CALCULADAS:
SEMANA ATUAL: 2026-01-20 até 2026-01-26
SEMANA PASSADA: 2026-01-13 até 2026-01-19
MÊS PASSADO: 2025-12-01 até 2025-12-31
ÚLTIMOS 7 DIAS: 2026-01-19 até 2026-01-26
ÚLTIMOS 30 DIAS: 2025-12-27 até 2026-01-26
```

### 2. Adicionar Parâmetros de Data nas Ferramentas

**`list_transactions`** (atual → melhorado):
```typescript
// ADICIONAR:
start_date: { type: "string", description: "Data início (YYYY-MM-DD)" },
end_date: { type: "string", description: "Data fim (YYYY-MM-DD)" }
```

**`get_finance_summary`** (atual → melhorado):
```typescript
// ADICIONAR:
period: { type: "string", enum: ["week", "month", "quarter", "custom"] },
start_date: { type: "string", description: "Para period=custom" },
end_date: { type: "string", description: "Para period=custom" }
```

### 3. Adicionar Instruções de Interpretação Temporal

Nova seção no system prompt:

```text
📆 INTERPRETAÇÃO DE PERÍODOS (CRÍTICO):

Quando o usuário perguntar sobre períodos, CALCULE as datas corretas:

"última semana" / "semana passada"
→ Use get_expenses_by_category com period: "week" OU
→ list_transactions com start_date/end_date da semana

"esse mês" / "mês atual"
→ Use get_finance_summary (já filtra mês atual)

"mês passado"
→ Use list_transactions/get_expenses_by_category com datas do mês anterior

"últimos X dias"
→ Calcule start_date = hoje - X dias, end_date = hoje

REGRA: NUNCA retorne dados fora do período pedido!
```

### 4. Atualizar Implementação das Ferramentas

**`list_transactions`** (implementação):
```typescript
case "list_transactions": {
  let query = supabaseAdmin.from("transactions").select("*").eq("user_id", userId);
  
  // NOVO: Filtros de data
  if (args.start_date) query = query.gte("transaction_date", args.start_date);
  if (args.end_date) query = query.lte("transaction_date", args.end_date);
  
  if (args.type) query = query.eq("type", args.type);
  if (args.is_paid !== undefined) query = query.eq("is_paid", args.is_paid);
  
  const { data, error } = await query.order("transaction_date", { ascending: false }).limit(args.limit || 50);
  // ...
}
```

**`get_finance_summary`** (implementação):
```typescript
case "get_finance_summary": {
  let startDate: Date;
  let endDate = getBrazilNow();
  
  switch (args.period) {
    case "week":
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "custom":
      startDate = new Date(args.start_date);
      endDate = new Date(args.end_date);
      break;
    default: // month
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  }
  
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("transaction_date", getBrazilDateStr(startDate))
    .lte("transaction_date", getBrazilDateStr(endDate));
  // ...
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/chat/index.ts` | Adicionar parâmetros de data em tools + atualizar implementações + expandir contexto temporal |

---

## Resultado Esperado

**Antes:**
```
User: "quanto gastei na última semana?"
Axiom: [Retorna dados do mês inteiro ou de períodos aleatórios]
```

**Depois:**
```
User: "quanto gastei na última semana?"
Axiom: 
"Olha os números da última semana (19/01 a 26/01) 💰

📱 Eletrônicos → R$ 5.148 (35%)
💊 Farmácia → R$ 3.282 (22%)
🏠 Moradia → R$ 1.660 (11%)

Total: R$ 14.664

Eletrônicos foi quase 1/3 do gasto 👀 O que rolou?"
```

---

## Cálculos Dinâmicos a Adicionar

O contexto temporal será expandido para incluir:

```text
SEMANA ATUAL (seg-dom):
→ Início: [segunda-feira atual calculada]
→ Fim: [domingo atual calculado]

SEMANA PASSADA:
→ Início: [segunda passada calculada]
→ Fim: [domingo passado calculado]

MÊS PASSADO:
→ Início: [dia 1 do mês anterior]
→ Fim: [último dia do mês anterior]

ÚLTIMOS 7/30/90 DIAS:
→ Cálculos automáticos baseados em hoje
```

---

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Precisão** | Dados genéricos | Dados exatos do período pedido |
| **Lógica** | Interpreta errado | Interpreta corretamente |
| **UX** | Frustração do usuário | Resposta esperada |
| **Flexibilidade** | Só mês atual | Qualquer período |

---

## Complexidade

| Item | Nível |
|------|-------|
| Risco de quebrar algo | Baixo (apenas adiciona parâmetros) |
| Esforço de implementação | Médio (~100 linhas) |
| Impacto positivo | Alto |

