

## 🚨 AUDITORIA DOS RELATÓRIOS SEMANAIS - BUGS CRÍTICOS DETECTADOS

Realizei uma auditoria exaustiva comparando os dados do print com o banco de dados real. **Encontrei um bug crítico que faz os números financeiros estarem ERRADOS**.

---

## ❌ BUG CRÍTICO: Transações sem Limite Superior de Data

### Problema Identificado

Na Edge Function `generate-weekly-report/index.ts`, **linha 136**:

```text
ATUAL (BUGADO):
supabase.from('transactions').select('*').eq('user_id', userId).gte('transaction_date', weekStartStr)

CORRETO (DEVERIA SER):
supabase.from('transactions').select('*').eq('user_id', userId)
  .gte('transaction_date', weekStartStr)
  .lte('transaction_date', weekEndStr)
```

### Impacto no Relatório do Print

| Métrica | Valor Mostrado | Valor Real (05/01 a 12/01) | Erro |
|---------|----------------|---------------------------|------|
| Receitas | R$ 14.961,00 | R$ 250,00 | +R$ 14.711,00 |
| Despesas | R$ 20.554,20 | R$ 273,00 | +R$ 20.281,20 |
| Saldo | R$ -5.593,20 | R$ -23,00 | Completamente errado |

### Causa Raiz

A query usa apenas `gte` (>=) sem `lte` (<=), então inclui transações **futuras** (parcelas, contas agendadas):
- Parcelas do Xiaomi até setembro/2026
- Parcelas do Monjaro até novembro/2026
- Outras transações agendadas para meses futuros

---

## ⚠️ Outros Problemas de Consistência de Datas

### Na Edge Function (linhas 132-138):

| Linha | Query | Problema |
|-------|-------|----------|
| 134 | `habit_logs` | Sem limite superior (gte sem lte) |
| 136 | `transactions` | ❌ **CRÍTICO** - Pega transações futuras |
| 137 | `notes` | Sem limite superior |
| 138 | `journal_entries` | Sem limite superior |

### Na página Intelligence.tsx:

A página tem a lógica **parcialmente correta** (usa gte + lte para transações mensais), mas:
- Linha 272: `notes` sem limite superior

---

## ✅ O Que Está CORRETO no Print

| Métrica | Valor | Status |
|---------|-------|--------|
| Tarefas: 0/0 (0%) | ✅ Correto | Usuário não tem tarefas |
| Hábitos ativos: 2/4 | ✅ Correto | 2 hábitos únicos completados (Leitura + Estudar) |
| Alto gasto em Eletrônicos | ⚠️ Incorreto | Valor inclui parcelas futuras |

---

## 📋 Correções Necessárias

### Correção 1: Edge Function generate-weekly-report

Adicionar `lte` nas queries de transactions, habit_logs, notes e journal:

```text
Linha 134 - habit_logs:
.gte('completed_at', weekStartStr).lte('completed_at', weekEndStr)

Linha 136 - transactions:
.gte('transaction_date', weekStartStr).lte('transaction_date', weekEndStr)

Linha 137 - notes:
.gte('created_at', weekStart.toISOString()).lte('created_at', now.toISOString())

Linha 138 - journal_entries:
.gte('entry_date', weekStartStr).lte('entry_date', weekEndStr)
```

### Correção 2: Também corrigir expensesByCategory

Linha 196-198: Os padrões de gasto por categoria usam a mesma query bugada, gerando "Alto gasto em Eletrônicos: R$10.952" quando deveria ser muito menos.

### Correção 3: Intelligence.tsx

Linha 272: Adicionar limite superior para notes:
```text
.gte('created_at', weekStart).lte('created_at', weekEnd)
```

---

## 🎯 Resumo

| Aspecto | Status |
|---------|--------|
| Relatório Semanal - Métricas Financeiras | ❌ **INCORRETAS** (incluem futuro) |
| Relatório Semanal - Hábitos | ✅ Corretas |
| Relatório Semanal - Tarefas | ✅ Corretas |
| Relatório Semanal - Padrões | ⚠️ Parcialmente incorretos (valores inflados) |
| Dashboard Intelligence - Finanças | ✅ Corretas (usa mês atual com limites) |

**Prioridade: CRÍTICA** - Este bug pode fazer o cliente ver informações financeiras completamente erradas, o que é inaceitável para uma ferramenta de gestão financeira.

---

## Plano de Correção

1. Corrigir a Edge Function `generate-weekly-report/index.ts` adicionando limites superiores de data em todas as queries
2. Corrigir a página `Intelligence.tsx` para consistência
3. Regenerar o relatório semanal para o cliente ver dados corretos
4. Testar com os dados atuais para confirmar que os valores batem

