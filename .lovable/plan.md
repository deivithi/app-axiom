

# 🔄 Migração: Lovable AI → OpenRouter

## Objetivo

Substituir a API Lovable AI pela API **OpenRouter** no chat principal do Axiom, permitindo acesso a múltiplos modelos de IA (OpenAI, Anthropic, Google, etc.) através de uma única API key.

---

## Vantagens do OpenRouter

| Aspecto | Benefício |
|---------|-----------|
| **Multi-modelo** | Acesso a GPT-4o, Claude 3.5, Gemini, Llama, etc. |
| **Redundância** | Se um modelo falhar, pode usar outro |
| **Preço competitivo** | Geralmente mais barato que APIs diretas |
| **Function Calling** | Suporte nativo para ferramentas (tools) |
| **API compatível** | Formato OpenAI-compatible (mesma estrutura) |

---

## Configuração Necessária

### Passo 1: Adicionar Secret `OPENROUTER_API_KEY`

Você precisará obter uma API key em [openrouter.ai](https://openrouter.ai) e adicioná-la como secret no projeto.

---

## Alterações Técnicas

### Arquivo: `supabase/functions/chat/index.ts`

#### 1. Substituir Obtenção da API Key (linhas 4105-4112)

```typescript
// ANTES
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

if (!lovableApiKey) {
  throw new Error("LOVABLE_API_KEY não configurada");
}

// DEPOIS
const openrouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

if (!openrouterApiKey) {
  throw new Error("OPENROUTER_API_KEY não configurada");
}
```

#### 2. Atualizar Chamada Non-Streaming para Tool Calls (linhas 4592-4605)

```typescript
// ANTES
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${lovableApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: currentMessages,
    tools,
    tool_choice: "auto",
    stream: false
  })
});

// DEPOIS
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${openrouterApiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://axiom.app",  // Identificação do app
    "X-Title": "Axiom AI"  // Nome do app no dashboard OpenRouter
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",  // Modelo recomendado para function calling
    messages: currentMessages,
    tools,
    tool_choice: "auto",
    stream: false
  })
});
```

#### 3. Atualizar Chamada Streaming Final (linhas 4742-4754)

```typescript
// ANTES
const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${lovableApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: currentMessages,
    stream: true
  })
});

// DEPOIS
const finalResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${openrouterApiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://axiom.app",
    "X-Title": "Axiom AI"
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",
    messages: currentMessages,
    stream: true
  })
});
```

#### 4. Atualizar Tratamento de Erros (linhas 4607-4617 e 4756-4766)

```typescript
// Manter tratamento de 429 e 402, adicionar erros específicos do OpenRouter
if (!response.ok) {
  const errorText = await response.text();
  console.error("[OpenRouter] API error:", errorText);
  
  if (response.status === 429) {
    throw new Error("Limite de requisições excedido. Aguarde um momento.");
  }
  if (response.status === 402) {
    throw new Error("Créditos OpenRouter insuficientes. Adicione créditos em openrouter.ai");
  }
  if (response.status === 401) {
    throw new Error("OPENROUTER_API_KEY inválida. Verifique a configuração.");
  }
  throw new Error(`OpenRouter error: ${response.status}`);
}
```

#### 5. Atualizar Logs para Clareza

```typescript
// Substituir logs de "[Lovable AI]" por "[OpenRouter]"
console.log(`[OpenRouter] Iteration ${iteration}: Making non-streaming request...`);
console.log(`[OpenRouter] Making final streaming request...`);
```

---

## Modelos Recomendados no OpenRouter

| Modelo | Uso | Custo |
|--------|-----|-------|
| `openai/gpt-4o` | **Recomendado** - melhor function calling | $$$ |
| `openai/gpt-4o-mini` | Economia com boa qualidade | $$ |
| `anthropic/claude-3.5-sonnet` | Alternativa de alta qualidade | $$$ |
| `google/gemini-pro-1.5` | Similar ao atual | $$ |

**Recomendação inicial:** `openai/gpt-4o` para garantir function calling confiável.

---

## Resumo das Alterações

| Local | Antes | Depois |
|-------|-------|--------|
| **Secret** | `LOVABLE_API_KEY` | `OPENROUTER_API_KEY` |
| **Endpoint** | `ai.gateway.lovable.dev` | `openrouter.ai/api/v1` |
| **Modelo** | `google/gemini-2.5-flash` | `openai/gpt-4o` |
| **Headers extras** | Nenhum | `HTTP-Referer`, `X-Title` |

---

## Fluxo de Implementação

1. ⏳ **Você adiciona** a `OPENROUTER_API_KEY` como secret
2. ✅ **Eu modifico** o arquivo `chat/index.ts` 
3. ✅ **Deploy automático** da Edge Function
4. ✅ **Teste** salvando um prompt no chat

---

## Custo Estimado

| Cenário | Custo/1M tokens (input) |
|---------|-------------------------|
| GPT-4o | ~$2.50 |
| GPT-4o-mini | ~$0.15 |
| Claude 3.5 Sonnet | ~$3.00 |

Para uso moderado (100-500 mensagens/dia), custo estimado: **$10-50/mês**.

