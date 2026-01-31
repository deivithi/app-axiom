

# 🚀 Upgrade do Modelo: GPT-4o-mini → GPT-5.2

## Objetivo

Atualizar o modelo de IA do Axiom de `openai/gpt-4o-mini` para `openai/gpt-5.2`, o modelo mais recente da OpenAI com capacidades avançadas de raciocínio.

---

## Mudanças Necessárias

### Arquivo: `supabase/functions/chat/index.ts`

| Linha | Antes | Depois |
|-------|-------|--------|
| 4801 | `model: "openai/gpt-4o-mini"` | `model: "openai/gpt-5.2"` |
| 4956 | `model: "openai/gpt-4o-mini"` | `model: "openai/gpt-5.2"` |

---

## Contexto Técnico

A arquitetura do Axiom usa duas chamadas ao modelo:

1. **Chamada Non-Streaming (linha 4801)**
   - Processa até 10 tool calls sequenciais
   - `stream: false` para parsing JSON confiável
   - Onde as 75 ferramentas são executadas

2. **Chamada Streaming (linha 4956)**
   - Gera a resposta final para o usuário
   - `stream: true` para resposta em tempo real
   - Sem tools (já foram processadas)

---

## Benefícios do GPT-5.2

| Aspecto | GPT-4o-mini | GPT-5.2 |
|---------|-------------|---------|
| **Raciocínio** | Bom | Avançado |
| **Contexto** | Menor | Maior |
| **Tool Calling** | Confiável | Ainda mais preciso |
| **Nuance** | Adequado | Excelente |

---

## Risco

| Item | Nível | Mitigação |
|------|-------|-----------|
| Compatibilidade | Baixo | API OpenRouter mantém formato |
| Custo | Médio | GPT-5.2 é mais caro que 4o-mini |
| Latência | Baixo | Pode ser ligeiramente maior |

---

## Implementação

Apenas 2 linhas de código precisam ser alteradas - uma mudança cirúrgica e segura.

