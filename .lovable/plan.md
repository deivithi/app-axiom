

# Correção: Tela Preta ao Clicar "Nova Transação"

## Problema Identificado

O Dialog (modal) do Radix UI usa `z-50` por padrão, mas o sistema de z-index do Axiom tem valores muito mais altos para elementos fixos:

```text
Dialog Overlay:      z-50  (bg-black/80)
Dialog Content:      z-50
BottomNavigation:    z-150 (--z-fixed)
Chat Backdrop:       z-200 (--z-modal-backdrop)
ChatPanel:           z-250 (--z-modal)
```

Resultado: o overlay preto do Dialog aparece, mas o conteudo do modal fica ATRAS da BottomNavigation e outros elementos fixos. O usuario ve apenas a tela preta sem o formulario.

## Solucao

Atualizar o componente `DialogOverlay` e `DialogContent` para usar z-indexes compativeis com a escala do projeto.

### Arquivo: `src/components/ui/dialog.tsx`

**DialogOverlay** - Mudar de `z-50` para `z-modal-backdrop` (200):

```tsx
// Antes
"fixed inset-0 z-50 bg-black/80 ..."

// Depois
"fixed inset-0 z-modal-backdrop bg-black/80 ..."
```

**DialogContent** - Mudar de `z-50` para `z-modal` (250):

```tsx
// Antes
"fixed left-[50%] top-[50%] z-50 grid ..."

// Depois
"fixed left-[50%] top-[50%] z-modal grid ..."
```

Isso garante que:
- O overlay do modal fica ACIMA da BottomNavigation (200 > 150)
- O conteudo do modal fica ACIMA de tudo (250)
- Alinhado com a mesma escala de z-index usada pelo ChatPanel e ActionSheet

### Verificacao adicional: Outros componentes com z-50

Verificar e atualizar tambem `sheet.tsx` e `alert-dialog.tsx` que provavelmente tem o mesmo problema com `z-50`.

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Tela preta sem formulario visivel | Modal aparece corretamente sobre todos os elementos |
| Dialog escondido atras da BottomNavigation | Dialog renderiza acima de tudo |

## Complexidade

- Risco: Baixo (apenas ajuste de z-index CSS)
- Linhas alteradas: ~6 linhas em 3 arquivos
- Impacto: Corrige todos os modais da aplicacao

