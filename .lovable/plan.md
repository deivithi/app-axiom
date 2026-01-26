

# 🚨 BUG CRÍTICO: Prompt Não Sendo Salvo - Model Alucinando Execução

## Diagnóstico Completo

### O Que Aconteceu

Você enviou:
> "salve o prompt abaixo: [prompt do Olavo de Carvalho]"

A IA respondeu:
> "Pronto Deivithi, salvei esse prompt na sua biblioteca ✅"

**MAS O PROMPT NÃO FOI SALVO!** O banco mostra que o último prompt foi criado em 20/12/2025.

### Causa Raiz Identificada

Os logs da Edge Function confirmam:
```
[z.ai] Iteration 1: finish_reason=stop, has_tool_calls=false
```

O modelo z.ai (GLM-4.7) **não chamou a ferramenta `create_prompt`** - ele simplesmente "alucionou" que tinha executado a ação sem realmente fazê-la.

### Por Que Isso Acontece

**Problema 1: Description da Tool Genérica Demais**

A description atual da tool `create_prompt` (linha 961) não inclui gatilhos de linguagem natural:
```typescript
// ATUAL
description: "Cria um novo prompt na biblioteca de prompts do usuário..."

// DEVERIA SER
description: "Cria um novo prompt na biblioteca. Use quando o usuário disser: 'salva esse prompt', 'guarda este prompt', 'adiciona na biblioteca', 'salvar prompt:', etc."
```

**Problema 2: System Prompt Sem Instruções de Trigger**

O system prompt (linha 4369) apenas lista as ferramentas sem explicar QUANDO usá-las:
```
- Biblioteca de Prompts: criar (create_prompt), listar (list_prompts)...
```

Compare com a seção de transações que tem triggers claros:
```
- "Quando disser 'gastei R$X em Y' → use create_transaction"
```

---

## Plano de Correção

### Correção 1: Melhorar Description da Tool `create_prompt`

Localização: `supabase/functions/chat/index.ts`, linhas 960-971

```typescript
// ANTES
{
  type: "function",
  function: {
    name: "create_prompt",
    description: "Cria um novo prompt na biblioteca de prompts do usuário. O diagnóstico será gerado automaticamente.",
    // ...
  }
}

// DEPOIS
{
  type: "function",
  function: {
    name: "create_prompt",
    description: "Salva um prompt na biblioteca do usuário com análise automática. SEMPRE use quando o usuário disser: 'salva esse prompt', 'salve o prompt', 'guarda este prompt', 'adiciona na biblioteca', 'salvar prompt:', 'salva como prompt'. Extraia o título do próprio prompt se não fornecido.",
    // ...
  }
}
```

### Correção 2: Adicionar Seção de Triggers no System Prompt

Localização: `supabase/functions/chat/index.ts`, após linha 4369 (na seção de ferramentas)

Adicionar nova seção específica para Biblioteca de Prompts com triggers:

```text
📚 BIBLIOTECA DE PROMPTS (SALVAR E GERENCIAR):
Quando o usuário disser QUALQUER variação de:
- "salva esse prompt" / "salve o prompt" / "guarda este prompt"
- "salvar prompt:" / "salva como prompt"
- "adiciona na biblioteca de prompts"

→ USE create_prompt IMEDIATAMENTE!
→ Extraia title do primeiro ## ou primeira frase significativa
→ Use o texto completo como prompt_text
→ Escolha category apropriada (geral, escrita, código, análise, criativo, negócios, outros)

NUNCA responda "salvei" sem realmente executar create_prompt!
```

### Correção 3: Adicionar Validação de Ação Executada

Para evitar que a IA afirme ter feito algo sem executar, adicionar validação no system prompt:

```text
⚠️ REGRA CRÍTICA DE HONESTIDADE:
NUNCA diga "salvei", "criei", "excluí" ou "atualizei" algo SEM TER EXECUTADO A TOOL CORRESPONDENTE!
- Se você NÃO chamou create_prompt, NÃO diga "salvei o prompt"
- Se você NÃO chamou create_task, NÃO diga "criei a tarefa"
- Confirme ações APENAS após receber success: true da ferramenta
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chat/index.ts` | 1. Melhorar description do `create_prompt` (linha 961) |
| `supabase/functions/chat/index.ts` | 2. Adicionar seção de triggers para prompts no system prompt (após 4369) |
| `supabase/functions/chat/index.ts` | 3. Adicionar regra de honestidade no system prompt |

---

## Impacto

Após estas correções:
- O modelo vai reconhecer "salva esse prompt" como trigger para `create_prompt`
- Logs mostrarão `[z.ai] Executing tool: create_prompt`
- Prompts serão salvos no banco com `ai_diagnosis` e `optimized_prompt`
- IA só confirmará salvamento após receber `success: true`

---

## Observação Importante

Este bug afeta potencialmente TODAS as ferramentas que não têm triggers explícitos no system prompt. Recomendo uma auditoria completa para adicionar triggers a:
- `create_saved_site` (para "salva esse site", "guarda essa URL")
- `update_user_context` (para "lembre que eu...", "anota que eu...")
- Outras ferramentas que dependem de linguagem natural

