
# 🔧 Remover Markdown das Respostas do Axiom

## Problema Identificado

O Axiom está gerando respostas com:
- `**texto**` (negrito markdown)
- Listas com `- ` (bullet markdown)
- Formato de lista numerada

Mesmo com o prompt dizendo "ZERO markdown", o modelo às vezes ainda gera.

---

## Solução em Duas Frentes

### 1. Reforçar no System Prompt

Adicionar exemplos ESPECÍFICOS de como formatar listas de gastos/categorias:

**ANTES (o que o modelo está fazendo):**
```
- **Eletrônicos**: R$ 5.148 (35%)
- **Farmácia**: R$ 3.282 (22%)
```

**DEPOIS (como deve ser):**
```
📱 Eletrônicos → R$ 5.148 (35%)
💊 Farmácia → R$ 3.282 (22%)
🏠 Moradia → R$ 1.660 (11%)
💳 Dívidas → R$ 1.120 (8%)
```

### 2. Sanitizar no Frontend (Fallback)

Atualizar `src/lib/formatMessage.tsx` para limpar markdown residual:

```typescript
// Antes de processar, limpar markdown
text = text
  .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **negrito**
  .replace(/^\s*-\s+/gm, '→ ')         // Converte - bullet em →
  .replace(/^\s*\d+\.\s+/gm, '→ ')     // Converte 1. em →
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/chat/index.ts` | Adicionar exemplos de formatação de listas com emojis de categoria |
| `src/lib/formatMessage.tsx` | Adicionar sanitização de markdown residual |

---

## Exemplo do Resultado Final

**Input do modelo (com markdown residual):**
```
- **Eletrônicos**: R$ 5.148 (35%)
- **Farmácia**: R$ 3.282 (22%)
```

**Output renderizado (após sanitização):**
```
→ Eletrônicos: R$ 5.148 (35%)
→ Farmácia: R$ 3.282 (22%)
```

---

## Emojis por Categoria (Adicionar ao Prompt)

Para o contexto financeiro específico, adicionar mapeamento de emojis:

```
📱 Eletrônicos
💊 Farmácia/Saúde
🏠 Moradia
💳 Dívidas/Empréstimos
📞 Telefonia
🛒 Mercado
📈 Investimentos
🎮 Lazer
📋 Assinaturas
💪 Suplementos
🏦 Poupança/Reserva
📚 Educação
🍔 Alimentação/Delivery
⛽ Transporte
👔 Vestuário
```

---

## Mudanças Técnicas

### System Prompt (linhas ~4361-4365)

Adicionar seção específica:

```
FORMATAÇÃO DE LISTAS DE CATEGORIAS:
❌ NUNCA faça assim:
- **Categoria**: R$ valor (X%)

✅ SEMPRE faça assim:
📱 Eletrônicos → R$ 5.148 (35%)
💊 Farmácia → R$ 3.282 (22%)
🏠 Moradia → R$ 1.660 (11%)

Use emojis que representem cada categoria!
```

### formatMessage.tsx

```typescript
export function formatMessageContent(text: string): React.ReactNode {
  if (!text) return null;
  
  // Sanitizar markdown residual
  let cleanText = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')     // Remove **negrito**
    .replace(/\*([^*]+)\*/g, '$1')          // Remove *itálico*
    .replace(/`([^`]+)`/g, '$1')            // Remove `código`
    .replace(/^#{1,6}\s+/gm, '')            // Remove ### headers
    .replace(/^\s*-\s+/gm, '→ ')            // - bullet → arrow
    .replace(/^\s*\*\s+/gm, '→ ')           // * bullet → arrow
    .replace(/^\s*\d+\.\s+/gm, '→ ');       // 1. → arrow
  
  // Divide por linha dupla (parágrafos)
  const paragraphs = cleanText.split(/\n\n+/);
  
  // ... resto do código
}
```

---

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Visual** | Asteriscos aparentes | Texto limpo com setas |
| **Consistência** | Depende do modelo | Garantido pelo frontend |
| **Categorias** | Texto puro | Emojis representativos |
| **Legibilidade** | Markdown cru | Formatação conversacional |
