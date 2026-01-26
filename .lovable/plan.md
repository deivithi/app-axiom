

## Correção da Formatação de Moeda Brasileira nos Relatórios Semanais

### Problema Identificado

Os valores financeiros nos relatórios semanais estão sendo exibidos no formato americano (`R$14961.00`) ao invés do formato brasileiro correto (`R$ 14.961,00`).

**Causa Raiz:** O ambiente Deno das Edge Functions do Supabase pode não ter o locale `pt-BR` disponível, fazendo com que o `Intl.NumberFormat` use o fallback padrão (formato US).

---

### Solução

Substituir o uso de `Intl.NumberFormat` por uma função de formatação manual que garante o formato brasileiro independente do ambiente de execução.

---

### Arquivos a Modificar

**1. `supabase/functions/generate-weekly-report/index.ts`**

Substituir a função `formatCurrency` (linhas 20-28) por uma versão manual:

```text
ANTES (usando Intl.NumberFormat - pode falhar no Deno):
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

DEPOIS (formatação manual garantida):
const formatCurrency = (value: number): string => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Formata com 2 casas decimais
  const parts = absValue.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  // Adiciona separador de milhar (ponto)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Monta o valor final com vírgula como separador decimal
  const formattedValue = `${formattedInteger},${decimalPart}`;
  
  return isNegative ? `R$ -${formattedValue}` : `R$ ${formattedValue}`;
};
```

---

### Formato Correto Garantido

| Valor | Antes (Bugado) | Depois (Correto) |
|-------|----------------|------------------|
| 14961 | `R$14961.00` | `R$ 14.961,00` |
| 20554.20 | `R$20554.20` | `R$ 20.554,20` |
| -5593.20 | `R$-5593.20` | `R$ -5.593,20` |
| 1234567.89 | `R$1234567.89` | `R$ 1.234.567,89` |

---

### Outras Verificações

Os padrões de gasto (linha 199) também usam `formatCurrency`:
```javascript
description: `${formatCurrency(amount)} esta semana`,
```

Isso será automaticamente corrigido pela nova função.

---

### Passos de Implementação

1. Atualizar a função `formatCurrency` na Edge Function `generate-weekly-report`
2. Fazer deploy da Edge Function atualizada
3. Regenerar o relatório semanal para testar

---

### Seção Técnica

A função manual garante:
- **Espaço após R$**: `R$ 14.961,00` (padrão brasileiro)
- **Ponto como separador de milhar**: `1.234.567`
- **Vírgula como separador decimal**: `,89`
- **Suporte a números negativos**: `R$ -5.593,20`
- **Independência do locale do sistema**: Funciona em qualquer ambiente

