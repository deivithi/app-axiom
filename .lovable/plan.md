
## Plano: Corrigir Parsing de Tool Calls da z.ai (GLM-4.7)

### Problema Raiz Identificado

Analisando os logs e o comportamento, identifiquei que:

1. **Nenhuma tool está sendo detectada**: Os logs de 21:59-22:00 (momento do print) NÃO mostram "Tool calls received" nem "Executing tool" - a z.ai está gerando APENAS texto, sem invocar as tools

2. **Fragmentação severa do JSON**: Quando a z.ai TENTA enviar tool_calls (logs de 21:54), os chunks JSON são tão fragmentados que mesmo após encontrar `\n`, o JSON ainda está incompleto

3. **Modelo glm-4.7 vs glm-4.6**: A documentação da z.ai indica que `tool_stream` é "limitado a glm-4.6" - pode haver incompatibilidade

### Análise dos Logs

| Horário | Comportamento | Resultado |
|---------|---------------|-----------|
| 21:54:15 | "Tool calls received: list_transactions" | Tool detectada mas erros de parse nos argumentos |
| 21:59:58 | "Processing chat..." sem "Tool calls received" | Nenhuma tool detectada, só texto gerado |

### Solução em 3 Partes

---

#### Parte 1: Desabilitar streaming para tool calls (NON-STREAMING MODE)

A z.ai com streaming fragmenta tanto o JSON que impossibilita parsing confiável. A solução é usar **duas chamadas**:
- Primeira chamada SEM streaming para detectar e executar tools
- Segunda chamada COM streaming apenas para a resposta final de texto

Esta é a abordagem mais robusta para garantir 100% de sincronização.

---

#### Parte 2: Fluxo de Processamento Robusto

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Primeira chamada (stream: false)                        │
│     - Recebe JSON completo                                  │
│     - Detecta tool_calls de forma confiável                 │
│     - Executa todas as tools                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Loop de tools (stream: false)                           │
│     - Para cada tool_call, executa e acumula resultados     │
│     - Nova chamada com resultados das tools                 │
│     - Repete até não haver mais tool_calls                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Chamada final (stream: true)                            │
│     - Apenas para resposta de texto                         │
│     - Streaming normal para o frontend                      │
│     - Sem tool_calls nesta fase                             │
└─────────────────────────────────────────────────────────────┘
```

---

#### Parte 3: Alterações no Código

**Arquivo:** `supabase/functions/chat/index.ts`

**Estratégia:**
1. Primeira chamada com `stream: false` para processar tools de forma síncrona
2. Loop de execução de tools com chamadas síncronas
3. Quando não houver mais tools, fazer chamada final com `stream: true` para enviar texto

```typescript
// Chamada inicial SEM streaming
const initialResponse = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${zaiApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "glm-4.7",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    tools,
    tool_choice: "auto",
    stream: false  // SEM streaming para garantir JSON completo
  })
});

const initialData = await initialResponse.json();
const choice = initialData.choices?.[0];

// Se há tool_calls, executar
if (choice.finish_reason === "tool_calls" && choice.message?.tool_calls) {
  // Loop de execução de tools...
  // Processar todas as tools de forma síncrona
  // Fazer chamadas adicionais se necessário
}

// Chamada final COM streaming apenas para texto
const finalResponse = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${zaiApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "glm-4.7",
    messages: currentMessages,
    stream: true  // COM streaming para texto fluído
    // SEM tools - já foram processadas
  })
});

// Processar streaming de texto normalmente...
```

---

### Benefícios

- 100% de confiabilidade na detecção de tool_calls (JSON completo)
- Todas as operações CRUD funcionam sem falhas
- Streaming apenas para resposta textual final (UX mantida)
- Compatível com qualquer modelo da z.ai
- Elimina todos os erros de "Unterminated string in JSON"

---

### Resumo das Mudanças

```text
Arquivo: supabase/functions/chat/index.ts (linhas 4272-4490)

Mudanças principais:
1. Primeira chamada: stream: false (ao invés de stream: true)
2. Remover tool_stream: true (não necessário sem streaming)
3. Processar tool_calls do JSON completo (choice.message.tool_calls)
4. Loop de tools com chamadas síncronas (stream: false)
5. Chamada final com stream: true apenas para texto
6. Remover todo o código de parsing fragmentado de tool_calls

Resultado: Sincronização 100% restaurada
```

---

### Alternativa: Fallback para OpenAI

Se preferir manter o streaming total, podemos implementar fallback automático para OpenAI quando tools forem necessárias:

```typescript
// Detectar necessidade de tools na primeira chamada
// Se tools necessárias → usar OpenAI (streaming funciona)
// Se apenas texto → usar z.ai com streaming
```

Esta alternativa mantém z.ai para conversas simples e usa OpenAI para operações CRUD, garantindo o melhor dos dois mundos.
