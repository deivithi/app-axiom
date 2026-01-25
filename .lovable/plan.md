
## Plano: Migrar Chat Principal para z.ai

### Objetivo
Substituir a integração OpenAI (GPT-5.2) pela z.ai (GLM-4.7) apenas no chat principal do Axiom, mantendo as demais funções (análise de padrões, relatórios semanais, extração de memórias) como estão.

---

### Sobre a z.ai

A z.ai é uma API compatível com o formato OpenAI, o que significa que a migração será simples:
- **URL Base:** `https://api.z.ai/api/paas/v4/chat/completions`
- **Autenticação:** Bearer token (igual OpenAI)
- **Modelos:** `glm-4.7` (flagship), `glm-4.7-flash`, `glm-4.6`, `glm-4.5`
- **Recursos:** Streaming, Function Calling e Response Format compatíveis

---

### Arquivos a serem modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/chat/index.ts` | Trocar endpoint e modelo da OpenAI para z.ai |

**Arquivos NÃO afetados** (continuam usando OpenAI/Lovable AI):
- `analyze-patterns/index.ts` - Continua com OpenAI
- `generate-weekly-report/index.ts` - Continua com OpenAI
- `extract-memories/index.ts` - Continua com Lovable AI Gateway

---

### Mudanças necessárias

#### 1. Adicionar secret ZAI_API_KEY

Será necessário armazenar sua chave API da z.ai como um secret:
- **Nome:** `ZAI_API_KEY`
- **Valor:** Sua chave da API z.ai

---

#### 2. Modificar `supabase/functions/chat/index.ts`

**Linha ~4270 (chamada inicial):**

```text
// ANTES:
const openAIApiKey = Deno.env.get("OPENAI_API_KEY")!;
...
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  ...
  headers: {
    Authorization: `Bearer ${openAIApiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-5.2",
    ...
  })
});

// DEPOIS:
const zaiApiKey = Deno.env.get("ZAI_API_KEY")!;
...
const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  ...
  headers: {
    Authorization: `Bearer ${zaiApiKey}`,
  },
  body: JSON.stringify({
    model: "glm-4.7",
    ...
  })
});
```

**Linha ~4386 (chamada de follow-up para tool calls):**

```text
// ANTES:
const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: {
    Authorization: `Bearer ${openAIApiKey}`,
  },
  body: JSON.stringify({
    model: "gpt-5.2",
    ...
  })
});

// DEPOIS:
const followUpResponse = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  headers: {
    Authorization: `Bearer ${zaiApiKey}`,
  },
  body: JSON.stringify({
    model: "glm-4.7",
    ...
  })
});
```

**Atualizar logs para refletir o novo modelo:**

```text
// ANTES:
console.log(`Processing chat for user: ${userName} (${user.id}) with model: gpt-5.2`);

// DEPOIS:
console.log(`Processing chat for user: ${userName} (${user.id}) with model: glm-4.7 (z.ai)`);
```

**Atualizar mensagens de erro:**

```text
// ANTES:
console.error("OpenAI API error:", errorText);
throw new Error(`OpenAI API error: ${response.status}`);

// DEPOIS:
console.error("z.ai API error:", errorText);
throw new Error(`z.ai API error: ${response.status}`);
```

---

### Resumo das alterações

```text
Arquivo: supabase/functions/chat/index.ts

Pontos de alteração:
  1. Variável de ambiente: OPENAI_API_KEY → ZAI_API_KEY
  2. Endpoint: api.openai.com → api.z.ai/api/paas/v4
  3. Modelo: gpt-5.2 → glm-4.7
  4. Logs e mensagens de erro
  
Total de locais: 2 chamadas fetch + logs
```

---

### Compatibilidade verificada

| Recurso | OpenAI | z.ai | Status |
|---------|--------|------|--------|
| Chat Completions | Sim | Sim | Compatível |
| Streaming | Sim | Sim | Compatível |
| Function Calling (tools) | Sim | Sim | Compatível |
| tool_choice: auto | Sim | Sim | Compatível |
| Formato de resposta | Idêntico | Idêntico | Compatível |

---

### Próximo passo necessário

Antes de implementar, preciso que você adicione sua chave API z.ai como secret. Usarei a ferramenta para solicitar isso na implementação.

---

### Resultado esperado

- Chat do Axiom utilizará z.ai (GLM-4.7) para todas as conversas
- Function calling continuará funcionando (criar tarefas, hábitos, transações, etc.)
- Streaming de respostas funcionará normalmente
- Funções secundárias continuam inalteradas com seus providers atuais
