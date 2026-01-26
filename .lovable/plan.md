

# 🔄 Alteração de Modelo: GPT-4o → DeepSeek V3.2

## Objetivo

Trocar o modelo do OpenRouter de `openai/gpt-4o` para `deepseek/deepseek-chat-v3-0324` (DeepSeek V3.2).

---

## DeepSeek V3.2 no OpenRouter

| Aspecto | Detalhe |
|---------|---------|
| **Modelo ID** | `deepseek/deepseek-chat-v3-0324` |
| **Context Window** | 64K tokens |
| **Function Calling** | Suportado |
| **Custo** | ~$0.14/1M tokens input, ~$0.28/1M output (muito mais barato que GPT-4o) |

---

## Alterações Técnicas

### Arquivo: `supabase/functions/chat/index.ts`

#### 1. Chamada Non-Streaming para Tools (linha 4601)

```typescript
// ANTES
model: "openai/gpt-4o",

// DEPOIS
model: "deepseek/deepseek-chat-v3-0324",
```

#### 2. Chamada Streaming Final (linha 4756)

```typescript
// ANTES
model: "openai/gpt-4o",

// DEPOIS
model: "deepseek/deepseek-chat-v3-0324",
```

---

## Resumo

| Local | Linha | Antes | Depois |
|-------|-------|-------|--------|
| Non-streaming | 4601 | `openai/gpt-4o` | `deepseek/deepseek-chat-v3-0324` |
| Streaming | 4756 | `openai/gpt-4o` | `deepseek/deepseek-chat-v3-0324` |

---

## Economia Estimada

| Modelo | Custo/1M tokens (input) | Custo/1M tokens (output) |
|--------|-------------------------|--------------------------|
| GPT-4o | ~$2.50 | ~$10.00 |
| DeepSeek V3.2 | ~$0.14 | ~$0.28 |
| **Economia** | **~95%** | **~97%** |

---

## Após Aprovação

1. Modificar as 2 linhas no arquivo `chat/index.ts`
2. Deploy automático da Edge Function
3. Testar salvando um prompt no chat

