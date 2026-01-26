
# 🚨 AUDITORIA CRÍTICA: Formatação de Moeda Brasileira - Correção Completa

## Diagnóstico do Problema

O relatório mostrado no print **foi gerado ANTES da correção** e além disso, identifiquei que a formatação de moeda está **inconsistente em 11+ lugares diferentes** do código.

### Valores Incorretos no Print
- ❌ `R$14961.00` → deveria ser `R$ 14.961,00`
- ❌ `R$20554.20` → deveria ser `R$ 20.554,20`
- ❌ `R$-5593.20` → deveria ser `R$ -5.593,20`
- ❌ `R$10952` → deveria ser `R$ 10.952,00`

---

## Causa Raiz: Formatação Fragmentada

### Problemas Identificados

**1. Edge Function `chat/index.ts` (4.806 linhas) - 5 OCORRÊNCIAS CRÍTICAS**

Usa `.toFixed(2)` direto em mensagens de confirmação:

| Linha | Contexto | Código Bugado |
|-------|----------|---------------|
| 1905 | Parcelamento | `` `R$ ${args.amount.toFixed(2)}` `` |
| 2020 | Lote de transações | `` `R$ ${total.toFixed(2)}` `` |
| 2188 | Lista de transações | `` `R$ ${Number(t.amount).toFixed(2)}` `` |
| 2265 | Pendências | `` `R$ ${total.toFixed(2)}` `` |
| 2290 | Resumo financeiro | `` `R$ ${income.toFixed(2)}` `` (4x na mesma linha) |

**2. Intelligence.tsx - 3 OCORRÊNCIAS**

Linhas 313-315:
```javascript
- Receitas: R$${summary.income.toFixed(2)}
- Despesas: R$${summary.expenses.toFixed(2)}
- Saldo: R$${(summary.income - summary.expenses).toFixed(2)}
```

**3. Funções Utilitárias Inconsistentes**

| Arquivo | Método Atual | Problema |
|---------|--------------|----------|
| `src/lib/utils.ts` | `Intl.NumberFormat` | Não garante espaço após R$ |
| `src/components/ui/currency-input.tsx` | `Intl.NumberFormat` | Duplicação, sem espaço garantido |
| `supabase/functions/generate-weekly-report/index.ts` | Manual ✅ | **Correto**, mas isolado |

**4. Outros Locais**

- `src/lib/generateFinancialPDF.ts:117` - usa `toLocaleString('pt-BR')` (OK para browser, mas inconsistente)
- `supabase/functions/inject-variables/index.ts:138-140` - usa `toLocaleString('pt-BR')` (OK, mas inconsistente)
- `src/components/ui/chart.tsx:212` - usa `toLocaleString()` SEM locale (❌ PERIGOSO)

---

## Solução: Formatação Centralizada e Manual

### Estratégia de Correção

1. **Criar função manual centralizada** que garante `R$ 14.961,00` em QUALQUER ambiente
2. **Substituir TODAS as 11+ ocorrências** por essa função
3. **Regenerar relatório semanal** para aplicar as correções
4. **Testar em todos os contextos** (Chat, Dashboard, PDF)

---

## Implementação Detalhada

### Passo 1: Atualizar `src/lib/utils.ts` com Formatação Manual

**SUBSTITUIR** a função `formatCurrency` atual (linhas 8-15):

```typescript
// ANTES (Intl.NumberFormat - não confiável)
export function formatCurrency(value: number, currency: string = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// DEPOIS (Manual - 100% confiável)
export function formatCurrency(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedValue = `${formattedInteger},${decimalPart}`;
  
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
}
```

### Passo 2: Atualizar `supabase/functions/chat/index.ts`

Adicionar a função `formatCurrency` no início da Edge Function (após imports):

```typescript
// Adicionar após linha 16 (após imports)
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
```

**SUBSTITUIR 5 ocorrências:**

| Linha | ANTES | DEPOIS |
|-------|-------|--------|
| 1905 | `` `R$ ${args.amount.toFixed(2)}` `` | `` `${formatCurrency(args.amount)}` `` |
| 1905 | `` `R$ ${totalValue.toFixed(2)}` `` | `` `${formatCurrency(totalValue)}` `` |
| 2020 | `` `R$ ${total.toFixed(2)}` `` | `` `${formatCurrency(total)}` `` |
| 2188 | `` `R$ ${Number(t.amount).toFixed(2)}` `` | `` `${formatCurrency(Number(t.amount))}` `` |
| 2265 | `` `R$ ${total.toFixed(2)}` `` | `` `${formatCurrency(total)}` `` |
| 2290 | `` `R$ ${income.toFixed(2)}` `` | `` `${formatCurrency(income)}` `` |
| 2290 | `` `R$ ${expenses.toFixed(2)}` `` | `` `${formatCurrency(expenses)}` `` |
| 2290 | `` `R$ ${pending.toFixed(2)}` `` | `` `${formatCurrency(pending)}` `` |
| 2290 | `` `R$ ${(income - expenses).toFixed(2)}` `` | `` `${formatCurrency(income - expenses)}` `` |

### Passo 3: Atualizar `src/pages/Intelligence.tsx`

Adicionar import no topo:
```typescript
import { formatCurrency } from "@/lib/utils";
```

**SUBSTITUIR linhas 313-315:**

```typescript
// ANTES
- Receitas: R$${summary.income.toFixed(2)}
- Despesas: R$${summary.expenses.toFixed(2)}
- Saldo: R$${(summary.income - summary.expenses).toFixed(2)}

// DEPOIS
- Receitas: ${formatCurrency(summary.income)}
- Despesas: ${formatCurrency(summary.expenses)}
- Saldo: ${formatCurrency(summary.income - summary.expenses)}
```

### Passo 4: Atualizar `src/components/ui/currency-input.tsx`

**SUBSTITUIR** a função `formatCurrency` local (linhas 12-19):

```typescript
// ANTES (Intl.NumberFormat)
const formatCurrency = (value: number, currency: string = "BRL"): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// DEPOIS (Manual)
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
```

Remover parâmetro `currency` da assinatura (linha 7):
```typescript
// ANTES
currency?: string;

// DEPOIS
// (remover essa linha)
```

Atualizar chamadas (linhas 25, 29, 46):
```typescript
// ANTES
formatCurrency(numValue, currency)

// DEPOIS
formatCurrency(numValue)
```

### Passo 5: Atualizar `src/lib/generateFinancialPDF.ts`

Adicionar import:
```typescript
import { formatCurrency } from "@/lib/utils";
```

**SUBSTITUIR linha 117:**
```typescript
// ANTES
const valueText = `R$ ${card.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// DEPOIS
const valueText = formatCurrency(card.value);
```

### Passo 6: Atualizar `supabase/functions/inject-variables/index.ts`

Adicionar função no início (após imports):
```typescript
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
```

**SUBSTITUIR linhas 138-140:**
```typescript
// ANTES
saldo_total: `R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
gastos_mes: `R$ ${monthExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
receitas_mes: `R$ ${monthIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,

// DEPOIS
saldo_total: formatCurrency(totalBalance),
gastos_mes: formatCurrency(monthExpenses),
receitas_mes: formatCurrency(monthIncome),
```

### Passo 7: Atualizar `src/components/ui/chart.tsx`

Adicionar import:
```typescript
import { formatCurrency } from "@/lib/utils";
```

**Problema na linha 212:** Usa `toLocaleString()` sem especificar locale

**Análise:** Este componente é genérico (Recharts wrapper), não é específico para moeda. MAS quando usado para valores financeiros, deve formatar corretamente.

**Solução:** Adicionar verificação de tipo de dado. Se o valor for monetário (payload contém "income", "expenses", "balance"), usar formatCurrency:

```typescript
// SUBSTITUIR linhas 210-214
{item.value && (
  <span className="font-mono font-medium tabular-nums text-foreground">
    {typeof item.value === 'number' && 
     (item.name?.toLowerCase().includes('receita') || 
      item.name?.toLowerCase().includes('despesa') || 
      item.name?.toLowerCase().includes('saldo'))
      ? formatCurrency(item.value)
      : item.value.toLocaleString('pt-BR')}
  </span>
)}
```

---

## Passo 8: Regenerar Relatório Semanal

Após todas as correções, executar:

1. **Deploy das Edge Functions** (chat + inject-variables)
2. **Gerar novo relatório** via chat ou manualmente através do endpoint

---

## Checklist de Validação

Após correções, testar:

| Contexto | Teste | Resultado Esperado |
|----------|-------|-------------------|
| Chat - Parcelamento | "comprei TV de 3000 em 10x" | `` `em 10x de R$ 300,00 (total: R$ 3.000,00)` `` |
| Chat - Lote | "gastei pão 10, leite 8, café 15" | `` `Total: R$ 33,00` `` |
| Chat - Lista | "/financeiro" | `` `Pão R$ 10,00` `` |
| Chat - Resumo | "resumo financeiro" | `` `Receitas: R$ 250,00` `` |
| Dashboard Intelligence | Abrir página | `` `Receitas: R$ 250,00` `` no resumo |
| Relatório Semanal | Gerar novo | `` `Receitas: R$ 14.961,00` `` formatado |
| PDF Financeiro | Exportar | `` `R$ 14.961,00` `` nos cards |
| Input de moeda | Digitar valor | `` `R$ 1.234,56` `` formatado |
| Gráficos | Hover no chart | `` `R$ 1.234,56` `` no tooltip |

---

## Formato Correto Garantido

### Exemplos de Saída

| Valor de Entrada | Saída Correta |
|------------------|---------------|
| `123.45` | `R$ 123,45` |
| `1234.56` | `R$ 1.234,56` |
| `12345.67` | `R$ 12.345,67` |
| `123456.78` | `R$ 123.456,78` |
| `1234567.89` | `R$ 1.234.567,89` |
| `-123.45` | `R$ -123,45` |
| `0` | `R$ 0,00` |
| `0.01` | `R$ 0,01` |

### Padrão Brasileiro (NBR)

✅ **Espaço após símbolo:** `R$ ` (não `R$`)  
✅ **Ponto como separador de milhar:** `1.234`  
✅ **Vírgula como separador decimal:** `,56`  
✅ **Sempre 2 casas decimais:** `,00` mesmo para inteiros  
✅ **Negativo com hífen:** `R$ -123,45`  

---

## Arquivos Modificados (Total: 7)

1. ✅ `src/lib/utils.ts` - Função centralizada
2. ✅ `supabase/functions/chat/index.ts` - 9 substituições
3. ✅ `src/pages/Intelligence.tsx` - 3 substituições
4. ✅ `src/components/ui/currency-input.tsx` - Função local + remoção de parâmetro
5. ✅ `src/lib/generateFinancialPDF.ts` - 1 substituição
6. ✅ `supabase/functions/inject-variables/index.ts` - 3 substituições
7. ✅ `src/components/ui/chart.tsx` - Condicional para valores monetários

---

## Impacto: 0 Defeitos de Formatação

Após estas correções, **100% dos valores monetários** no sistema usarão o padrão brasileiro correto, independente do ambiente (browser, Deno, Node.js).

**Status: CRÍTICO - BLOQUEADOR PARA ENTREGA AO CLIENTE**

Todos os módulos (Chat, Dashboards, Relatórios, PDF, Variáveis) estarão sincronizados com formatação consistente e profissional.
