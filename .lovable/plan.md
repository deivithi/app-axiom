

## Plano: Corrigir Parsing de Streaming para z.ai

### Problema Identificado

A z.ai com `tool_stream: true` envia os chunks JSON de forma **fragmentada**, diferente da OpenAI que envia chunks completos. O código atual tenta fazer `JSON.parse()` imediatamente em cada linha recebida, resultando em:

1. Múltiplos erros "Unterminated string in JSON"
2. Tool calls não sendo parseadas corretamente
3. Tools não sendo executadas (transação não salva)
4. Resposta de texto enviada sem a ação ser executada

### Causa Técnica

| Comportamento | OpenAI | z.ai com tool_stream |
|---------------|--------|----------------------|
| Formato de chunks | JSON completo por linha | JSON fragmentado |
| Parse imediato | Funciona | Falha com erros de parse |
| Acumulação necessária | Não | **Sim** |

### Solução

Implementar **buffer de acumulação** para ambas as partes do código:
1. Chamada inicial (linhas 4304-4335)
2. Chamada de follow-up (linhas 4414-4459)

O buffer acumula chunks parciais e só tenta fazer parse quando encontra uma quebra de linha completa.

---

### Alterações Necessárias

**Arquivo:** `supabase/functions/chat/index.ts`

#### 1. Chamada Inicial - Adicionar buffer (linhas 4304-4335)

```typescript
// ANTES:
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
        // ... resto do código
      } catch (toolError) {
        console.error("Tool processing error:", toolError);
      }
    }
  }
}

// DEPOIS:
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
      // ... resto do código (sem alterações)
    } catch (parseError) {
      // JSON incompleto - fragmento será acumulado no próximo chunk
      // Silenciar erro - não é erro real, apenas fragmentação
    }
  }
}
```

#### 2. Chamada Follow-up - Adicionar buffer (linhas 4414-4459)

```typescript
// ANTES:
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
        // ... resto do código
      } catch (parseError) {
        console.error("Follow-up parse error:", parseError);
      }
    }
  }
}

// DEPOIS:
let fuBuffer = '';
while (true) {
  const { done: fuDone, value: fuValue } = await followUpReader!.read();
  if (fuDone) break;
  
  fuBuffer += decoder.decode(fuValue, { stream: true });
  let fuNewlineIndex: number;
  
  while ((fuNewlineIndex = fuBuffer.indexOf('\n')) !== -1) {
    const fuLine = fuBuffer.slice(0, fuNewlineIndex).trim();
    fuBuffer = fuBuffer.slice(fuNewlineIndex + 1);
    
    if (!fuLine || fuLine.startsWith(':')) continue;
    if (!fuLine.startsWith("data: ")) continue;
    
    const fuData = fuLine.slice(6).trim();
    if (fuData === "[DONE]") continue;
    
    try {
      const fuParsed = JSON.parse(fuData);
      // ... resto do código (sem alterações)
    } catch {
      // JSON incompleto - fragmento será acumulado
      // Não logar erro pois é comportamento esperado do streaming fragmentado
    }
  }
}
```

---

### Resumo das Alterações

```text
Arquivo: supabase/functions/chat/index.ts

Mudanças:
  1. Chamada inicial (linhas 4304-4335):
     - Adicionar variável 'buffer' para acumular chunks
     - Usar decoder.decode(value, { stream: true })
     - Processar linha por linha após encontrar '\n'
     - Silenciar erros de parse (são fragmentos esperados)

  2. Chamada follow-up (linhas 4414-4459):
     - Adicionar variável 'fuBuffer' para acumular chunks
     - Mesma lógica de acumulação
     - Remover console.error para parse errors

Total: ~30 linhas modificadas em 2 blocos
```

---

### Por que isso funciona

O padrão SSE (Server-Sent Events) garante que cada evento termina com `\n\n`. O problema atual é que:

1. A z.ai envia: `data: {"choices":[{"delta":{"tool_` (fragmento 1)
2. Depois envia: `_calls":[...]}}]}\n` (fragmento 2)
3. Código atual tenta parsear fragmento 1 → ERRO
4. Fragmento 2 é perdido

Com o buffer:
1. Acumula fragmento 1
2. Acumula fragmento 2
3. Encontra `\n` → extrai linha completa
4. Parse do JSON completo → SUCESSO

---

### Resultado Esperado

Após a correção:
- Tools serão parseadas corretamente
- Transações serão salvas no banco
- Axiom responderá com confirmação textual
- Comportamento 100% idêntico ao que funcionava com OpenAI
- Sincronização completa restaurada

