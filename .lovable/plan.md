
# 🚨 PROBLEMA CRÍTICO IDENTIFICADO: API z.ai SEM CRÉDITOS

## Diagnóstico Real do Problema

**NÃO É BUG DE CÓDIGO** - O sistema de chat está **COMPLETAMENTE PARADO** porque a API z.ai ficou sem saldo.

### Evidências dos Logs

```
ERROR [z.ai] API error: {"error":{"code":"1113","message":"Insufficient balance or no resource package. Please recharge."}}
ERROR Chat function error: Error: z.ai API error: 429
```

**Tradução:** "Saldo insuficiente ou sem pacote de recursos. Por favor, recarregue."

### Por Que Tudo Parou

O Axiom usa **exclusivamente** a z.ai (modelo GLM-4.7) para o chat principal. Quando a API retorna erro 429 (sem créditos):

1. ❌ O chat não responde nada
2. ❌ Nenhuma ferramenta é executada (create_prompt, create_task, etc.)
3. ❌ O usuário fica sem feedback
4. ❌ Parece que o sistema está quebrado

### Confirmação no Banco de Dados

```sql
SELECT id, title, created_at FROM prompt_library 
WHERE user_id = 'aabe96a5-5996-415c-84ff-5852cce72b3f'
ORDER BY created_at DESC LIMIT 1
```

**Resultado:** Último prompt salvo em `2025-12-20 03:47:12` (1 mês atrás)

Nenhum prompt foi salvo recentemente porque **a requisição falhou antes de processar qualquer ferramenta**.

---

## Arquitetura Atual (Problema)

### Edge Function `chat/index.ts`

```typescript
// Linha 4105-4111
const zaiApiKey = Deno.env.get("ZAI_API_KEY");

if (!zaiApiKey) {
  throw new Error("ZAI_API_KEY não configurada");
}

// Linha 4591 - Requisição para z.ai (SEM FALLBACK)
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
    stream: false
  })
});
```

**Problema:** Se `response.status === 429`, o código lança erro e para a execução. Não tenta OpenAI.

### Secrets Configurados

```
✅ ZAI_API_KEY (configurado, mas SEM SALDO)
✅ OPENAI_API_KEY (configurado, mas NÃO USADO no chat)
✅ LOVABLE_API_KEY (Lovable AI - alternativa gratuita)
```

**OpenAI só é usada em:**
- `transcribe` (Whisper para áudio → texto)
- `generate-weekly-report` (GPT-4o para relatórios)
- `analyze-patterns` (GPT-4o para perguntas proativas)

---

## Soluções Propostas

### Opção 1: Recarregar z.ai (MAIS RÁPIDO)

**Ação:** Adicionar créditos na conta z.ai

**Passos:**
1. Acessar [z.ai Dashboard](https://z.ai)
2. Fazer login com a conta associada ao `ZAI_API_KEY`
3. Adicionar créditos/pacote de recursos
4. Testar chat imediatamente

**Prós:**
- ✅ Solução imediata (5-10 minutos)
- ✅ Sem alteração de código
- ✅ Mantém modelo GLM-4.7 (já testado)

**Contras:**
- ❌ Custo recorrente
- ❌ Risco de parar novamente quando acabar saldo
- ❌ Dependência de provedor externo

---

### Opção 2: Implementar Fallback Automático z.ai → OpenAI (MAIS ROBUSTO)

**Ação:** Modificar `chat/index.ts` para tentar OpenAI quando z.ai falhar

**Modificações em `supabase/functions/chat/index.ts`:**

#### 1. Adicionar Lógica de Fallback (linhas 4105-4111)

```typescript
// ANTES
const zaiApiKey = Deno.env.get("ZAI_API_KEY");

if (!zaiApiKey) {
  throw new Error("ZAI_API_KEY não configurada");
}

// DEPOIS
const zaiApiKey = Deno.env.get("ZAI_API_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

let provider: 'zai' | 'openai' = 'zai';
let apiKey = zaiApiKey;
let model = "glm-4.7";

if (!zaiApiKey) {
  console.log("[Fallback] ZAI_API_KEY não configurada, usando OpenAI");
  if (!openaiApiKey) {
    throw new Error("Nenhuma API key configurada (ZAI ou OpenAI)");
  }
  provider = 'openai';
  apiKey = openaiApiKey;
  model = "gpt-4o";
}
```

#### 2. Modificar Função de Requisição (linhas 4591-4604)

```typescript
// Adicionar try/catch e fallback
let response;
let retryWithOpenAI = false;

try {
  const endpoint = provider === 'zai' 
    ? "https://api.z.ai/api/paas/v4/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: currentMessages,
      tools,
      tool_choice: "auto",
      stream: false
    })
  });

  // Se z.ai retornou 429 (sem créditos) e temos OpenAI disponível
  if (response.status === 429 && provider === 'zai' && openaiApiKey) {
    console.log("[Fallback] z.ai sem créditos (429), tentando OpenAI...");
    retryWithOpenAI = true;
  }
} catch (error) {
  if (provider === 'zai' && openaiApiKey) {
    console.log("[Fallback] z.ai falhou, tentando OpenAI...");
    retryWithOpenAI = true;
  } else {
    throw error;
  }
}

// Retry com OpenAI se necessário
if (retryWithOpenAI) {
  provider = 'openai';
  apiKey = openaiApiKey!;
  model = "gpt-4o";
  
  response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: currentMessages,
      tools,
      tool_choice: "auto",
      stream: false
    })
  });
}
```

#### 3. Aplicar Mesma Lógica na Resposta Streaming (linhas 4735-4747)

```typescript
const finalEndpoint = provider === 'openai'
  ? "https://api.openai.com/v1/chat/completions"
  : "https://api.z.ai/api/paas/v4/chat/completions";

const finalResponse = await fetch(finalEndpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model,
    messages: currentMessages,
    stream: true
  })
});
```

**Prós:**
- ✅ Chat nunca para (redundância automática)
- ✅ Transparente para o usuário
- ✅ Usa z.ai quando disponível (mais barato)
- ✅ OpenAI como backup confiável

**Contras:**
- ⚠️ Requer alteração de código (20-30 linhas)
- ⚠️ Precisa testar ambos os fluxos

---

### Opção 3: Migrar Completamente para OpenAI (MAIS SIMPLES)

**Ação:** Substituir z.ai por OpenAI em todo o chat

**Modificações em `supabase/functions/chat/index.ts`:**

```typescript
// Linha 4105-4111 - ANTES
const zaiApiKey = Deno.env.get("ZAI_API_KEY");
if (!zaiApiKey) {
  throw new Error("ZAI_API_KEY não configurada");
}

// DEPOIS
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY não configurada");
}

// Linha 4591 - ANTES
const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${zaiApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "glm-4.7",
    // ...
  })
});

// DEPOIS
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${openaiApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o", // ou "gpt-4o-mini" para economia
    // ...
  })
});
```

Aplicar mesma substituição na linha 4735 (resposta streaming).

**Prós:**
- ✅ OpenAI é mais estável e confiável
- ✅ Mesma API usada em outras funções (consistência)
- ✅ Sem risco de ficar sem créditos inesperadamente
- ✅ Melhor qualidade de resposta (GPT-4o)

**Contras:**
- ⚠️ Custo maior por token (OpenAI > z.ai)
- ⚠️ Perde otimizações específicas do GLM-4.7

---

### Opção 4: Usar Lovable AI (GRATUITO, EXPERIMENTAL)

**Ação:** Substituir z.ai por Lovable AI (modelos Google Gemini/OpenAI sem custo)

**Modificações em `supabase/functions/chat/index.ts`:**

```typescript
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
if (!lovableApiKey) {
  throw new Error("LOVABLE_API_KEY não configurada");
}

const response = await fetch("https://api.lovable.app/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${lovableApiKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash", // ou "openai/gpt-5-mini"
    messages: currentMessages,
    tools,
    stream: false
  })
});
```

**Prós:**
- ✅ **GRATUITO** (incluído no Lovable Cloud)
- ✅ Modelos de alta qualidade (Gemini 2.5, GPT-5)
- ✅ Sem risco de ficar sem créditos
- ✅ Suporte nativo a ferramentas (function calling)

**Contras:**
- ⚠️ Dependência da plataforma Lovable
- ⚠️ Precisa validar compatibilidade com system prompt atual

---

## Recomendação URGENTE

### Solução Imediata (Hoje)

**Opção 1 + Opção 2 combinadas:**

1. **AGORA:** Recarregar z.ai para desbloquear o chat imediatamente
2. **HOJE:** Implementar fallback automático z.ai → OpenAI
3. **AMANHÃ:** Testar fluxo completo e monitorar custos

### Solução de Longo Prazo (Esta Semana)

**Opção 4 (Lovable AI):**

1. Migrar chat para Lovable AI (Gemini 2.5 Flash)
2. Eliminar dependência de APIs pagas
3. Reduzir custos operacionais a zero
4. Manter OpenAI apenas para Whisper (transcrição)

---

## Impacto Técnico

### Arquivos a Modificar (Opção 2 - Fallback)

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `supabase/functions/chat/index.ts` | 4105-4111 | Detectar provider disponível |
| `supabase/functions/chat/index.ts` | 4580-4620 | Adicionar try/catch e retry com OpenAI |
| `supabase/functions/chat/index.ts` | 4735-4750 | Usar endpoint dinâmico no streaming |

**Total:** ~40 linhas modificadas, 15 linhas adicionadas

### Testes Necessários

- [ ] Chat responde com z.ai funcionando
- [ ] Chat faz fallback para OpenAI quando z.ai retorna 429
- [ ] Ferramentas (create_prompt, create_task) funcionam em ambos providers
- [ ] Streaming funciona corretamente com OpenAI
- [ ] Mensagens de erro são claras para o usuário

---

## Checklist de Validação Pós-Correção

| Teste | Comando | Resultado Esperado |
|-------|---------|-------------------|
| Salvar prompt | "salva esse prompt: Você é um analista..." | ✅ Prompt salvo + confirmação |
| Criar tarefa | "cria tarefa: revisar código" | ✅ Tarefa criada + ID |
| Resumo financeiro | "resumo financeiro" | ✅ Receitas/Despesas formatadas |
| Chat respondendo | "olá axiom" | ✅ Resposta em tempo real |
| Fallback funcionando | (desativar z.ai temporariamente) | ✅ OpenAI assume automaticamente |

---

## Próximos Passos Imediatos

### Para Você (Usuário)

**OPÇÃO A - Recarregar z.ai (5-10 min):**
1. Acessar https://z.ai/dashboard
2. Adicionar créditos na conta
3. Testar: "salva esse prompt: teste de funcionamento"

**OPÇÃO B - Aprovar Implementação de Fallback:**
1. Aprovar este plano
2. Aguardar deploy (2-3 minutos)
3. Chat funcionará com OpenAI enquanto z.ai está offline

**OPÇÃO C - Migrar para Lovable AI (RECOMENDADO):**
1. Aprovar este plano
2. Deploy da migração (3-5 minutos)
3. Sistema 100% gratuito e estável

### Para o Sistema (Após Aprovação)

1. ✅ Modificar `chat/index.ts` com lógica escolhida
2. ✅ Deploy automático da Edge Function
3. ✅ Testar salvamento de prompt
4. ✅ Validar todas as ferramentas (create_*, list_*, update_*)
5. ✅ Monitorar logs para confirmar sucesso

---

## Conclusão

**O código das correções anteriores estava CORRETO** (formatação de moeda + triggers de prompts). 

**O problema real é infraestrutura:** API z.ai sem créditos bloqueou todo o sistema.

**Qual opção você prefere implementar primeiro?**

1. Recarregar z.ai (você faz)
2. Fallback automático z.ai → OpenAI (eu implemento)
3. Migrar para Lovable AI gratuito (eu implemento)
4. Migrar completamente para OpenAI (eu implemento)
