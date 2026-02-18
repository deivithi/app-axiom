

# Correção: Tela Preta ao Abrir Modais no Mobile

## Problema Real Identificado

O "fix" anterior de z-index foi um **no-op** -- o codigo JA usava `z-modal-backdrop` e `z-modal` desde o inicio. O problema real tem duas causas:

### Causa 1: DialogContent sem scroll no mobile

O componente `DialogContent` NAO tem `max-height` nem `overflow-y-auto`. Formularios longos como "Nova Transacao" (10+ campos) excedem a altura da viewport no mobile:

```text
Dialog natural height:  ~900px
Viewport height:        ~844px (iPhone)
top: 50% =              422px
translate-y: -50% =     -450px (50% de 900px)
Final top:              -28px (ACIMA do viewport!)
```

O conteudo do dialog ultrapassa AMBOS os lados da tela, e com `bg-background` (cor muito escura no dark mode) + overlay `bg-black/80`, o resultado visual e uma tela completamente preta.

### Causa 2: Ordem do DOM no AppLayout

No `AppLayout.tsx`, o backdrop do chat e renderizado DEPOIS do `ChatPanel` no DOM (linha 62-67), o que pode causar problemas de stacking context em alguns browsers:

```text
Ordem atual do DOM:
1. <main> (conteudo)
2. <ChatPanel> (z-modal = 250)
3. <BottomNavigation> (z-fixed = 150)
4. <div backdrop> (z-[200])  <-- DEPOIS do ChatPanel
```

---

## Solucao

### 1. DialogContent: Adicionar scroll e altura maxima

**Arquivo:** `src/components/ui/dialog.tsx`

Adicionar `max-h-[85vh] overflow-y-auto` ao `DialogContent` para garantir que formularios longos sejam scrollaveis no mobile:

```tsx
// Antes
"fixed left-[50%] top-[50%] z-modal grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg ..."

// Depois
"fixed left-[50%] top-[50%] z-modal grid w-full max-w-lg max-h-[85vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg ..."
```

### 2. AlertDialogContent: Mesma correcao

**Arquivo:** `src/components/ui/alert-dialog.tsx`

Aplicar a mesma mudanca ao `AlertDialogContent`.

### 3. AppLayout: Reordenar DOM

**Arquivo:** `src/components/layout/AppLayout.tsx`

Mover o backdrop do chat para ANTES do ChatPanel no DOM, para que a ordem reflita corretamente a hierarquia visual:

```tsx
// Antes:
<ChatPanel ... />
{isMobile && !chatOpen && <BottomNavigation />}
{chatOpen && isMobile && <div backdrop ... />}

// Depois:
{chatOpen && isMobile && <div backdrop ... />}
<ChatPanel ... />
{isMobile && !chatOpen && <BottomNavigation />}
```

---

## Resumo de Mudancas

| Arquivo | Mudanca | Impacto |
|---------|---------|---------|
| `dialog.tsx` | Adicionar `max-h-[85vh] overflow-y-auto` | Dialogs longos ficam scrollaveis |
| `alert-dialog.tsx` | Mesma correcao | Alertas longos ficam scrollaveis |
| `AppLayout.tsx` | Reordenar backdrop antes do ChatPanel | Fix stacking context |

## Resultado Esperado

- Clicar "Nova Transacao" mostra o formulario scrollavel sobre fundo escuro
- Todos os modais da aplicacao ficam visiveis e usaveis no mobile
- Nenhuma tela preta ao abrir qualquer dialog

## Risco

Baixo -- apenas ajustes de CSS e reordenacao de DOM sem mudanca de logica.
