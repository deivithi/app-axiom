
## Plano: Corrigir Streaming de Respostas na z.ai

### Problema Identificado

A z.ai possui um parâmetro específico **`tool_stream`** que não existe na OpenAI. Sem ele, o modelo executa as tools corretamente, mas **não envia a resposta textual final** para o usuário.

### Causa Técnica

Nos logs, vemos:
1. ✅ Tool executada com sucesso: `create_transaction` ou `delete_transaction`
2. ❌ Múltiplos erros de parse JSON: `"Unterminated string in JSON at position X"`
3. ❌ `BadResource: Bad resource ID` - stream encerrado prematuramente
4. ❌ Sem resposta de texto enviada ao frontend

O problema está na falta do parâmetro `tool_stream: true` nas chamadas à API z.ai.

### Diferenças z.ai vs OpenAI

| Recurso | OpenAI | z.ai |
|---------|--------|------|
| Streaming de texto | `stream: true` | `stream: true` |
| Streaming de tool calls | automático | **requer `tool_stream: true`** |
| Campo reasoning | não existe | `delta.reasoning_content` |

---

### Alterações Necessárias

**Arquivo:** `supabase/functions/chat/index.ts`

#### 1. Chamada inicial (linha ~4270)

```typescript
// ANTES:
body: JSON.stringify({
  model: "glm-4.7",
  messages: [...],
  tools,
  tool_choice: "auto",
  stream: true
})

// DEPOIS:
body: JSON.stringify({
  model: "glm-4.7",
  messages: [...],
  tools,
  tool_choice: "auto",
  stream: true,
  tool_stream: true  // ← ADICIONAR
})
```

#### 2. Chamada de follow-up (linha ~4392)

```typescript
// ANTES:
body: JSON.stringify({
  model: "glm-4.7",
  messages: currentMessages,
  tools,
  tool_choice: "auto",
  stream: true
})

// DEPOIS:
body: JSON.stringify({
  model: "glm-4.7",
  messages: currentMessages,
  tools,
  tool_choice: "auto",
  stream: true,
  tool_stream: true  // ← ADICIONAR
})
```

---

### Resumo das Alterações

```text
Arquivo: supabase/functions/chat/index.ts

Mudanças:
  1. Adicionar tool_stream: true na chamada inicial (~linha 4285)
  2. Adicionar tool_stream: true na chamada de follow-up (~linha 4397)

Total: 2 linhas adicionadas
```

---

### Resultado Esperado

Após a correção:
- ✅ Axiom executará a tool (criar/deletar transação, etc.)
- ✅ Axiom responderá com mensagem de confirmação como antes
- ✅ Streaming funcionará normalmente para texto e tool calls
- ✅ Comportamento idêntico ao que tinha com OpenAI

---

### Por que isso funciona

O parâmetro `tool_stream: true` instrui a z.ai a:
1. Enviar chunks de tool calls em tempo real durante o streaming
2. Manter o stream aberto para enviar a resposta textual após a execução das tools
3. Evitar o encerramento prematuro que causa os erros de parse JSON parciais

Sem este parâmetro, a z.ai pode estar tentando enviar as tool calls de forma não-incremental, causando chunks JSON malformados e perdendo a resposta final.
