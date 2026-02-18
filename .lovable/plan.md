

# Fix Definitivo: Tela Preta nos Modais - Abordagem Radical

## Diagnostico Atual

Todas as correcoes de z-index JA estao aplicadas corretamente:
- DialogOverlay: `z-modal-backdrop` (200) -- OK
- DialogContent: `z-modal` (250) -- OK  
- SelectContent: `z-popover` (300) -- OK
- DrawerOverlay/Content: `z-modal-backdrop`/`z-modal` -- OK
- BottomNavigation: `z-fixed` (150) -- OK

No entanto, a tela preta persiste. Isso indica que o problema NAO e apenas z-index, mas sim um **conflito de stacking context** ou **problema de renderizacao mobile**.

## Causa Raiz Provavel

1. **ChatPanel compete com Dialog**: O ChatPanel usa `z-modal` (250) -- o MESMO valor que o DialogContent. No mobile, o ChatPanel e renderizado fixo mesmo quando fechado (apenas escondido via transform/width), criando um stacking context que pode engolir o Dialog.

2. **Chat backdrop hardcoded**: Em `AppLayout.tsx` linha 55, o backdrop usa `z-[200]` hardcoded em vez de `z-modal-backdrop`. Embora numericamente igual, Tailwind pode gerar classes diferentes.

3. **O Dialog abre mas fica visualmente ATRAS**: O DialogPortal renderiza no `document.body`, mas se o body tem um stacking context inesperado criado por `backdrop-filter` no ChatPanel ou BottomNavigation, o Dialog pode nao renderizar na frente.

## Solucao Definitiva

### 1. Elevar z-index do Dialog ACIMA de tudo

**Arquivo:** `src/components/ui/dialog.tsx`

Mudar DialogOverlay para `z-[9990]` e DialogContent para `z-[9995]` -- valores altissimos que garantem que NADA na aplicacao possa ficar na frente do modal.

```tsx
// DialogOverlay
"fixed inset-0 z-[9990] bg-black/80 ..."

// DialogContent  
"fixed left-[50%] top-[50%] z-[9995] grid w-full max-w-lg max-h-[85vh] overflow-y-auto ..."
```

### 2. Elevar z-index do AlertDialog igualmente

**Arquivo:** `src/components/ui/alert-dialog.tsx`

Mesma mudanca: overlay `z-[9990]`, content `z-[9995]`.

### 3. Elevar Select/Popover/Dropdown para z-[9998]

**Arquivos:** `select.tsx`, `popover.tsx`, `dropdown-menu.tsx`

Garantir que popups dentro de modais ficam ACIMA do modal content:

```tsx
// SelectContent, PopoverContent, DropdownMenuContent
"z-[9998] ..."
```

### 4. Corrigir chat backdrop hardcoded

**Arquivo:** `src/components/layout/AppLayout.tsx`

Mudar `z-[200]` para `z-modal-backdrop` para consistencia:

```tsx
// Antes
"fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"

// Depois  
"fixed inset-0 bg-black/60 backdrop-blur-sm z-modal-backdrop"
```

### 5. Esconder BottomNavigation quando Dialog esta aberto

**Arquivo:** `src/components/mobile/BottomNavigation.tsx`

Adicionar `pointer-events-none` e opacidade 0 quando um dialog esta aberto (usando data attribute no body), OU simplesmente garantir que o BottomNavigation nao intercepta toques no overlay do Dialog.

## Resumo

| Componente | Z-Index Atual | Z-Index Novo |
|-----------|--------------|-------------|
| BottomNavigation | z-fixed (150) | z-fixed (150) - sem mudanca |
| Chat Backdrop | z-[200] | z-modal-backdrop (200) |
| ChatPanel | z-modal (250) | z-modal (250) - sem mudanca |
| Dialog Overlay | z-modal-backdrop (200) | z-[9990] |
| Dialog Content | z-modal (250) | z-[9995] |
| AlertDialog Overlay | z-modal-backdrop (200) | z-[9990] |
| AlertDialog Content | z-modal (250) | z-[9995] |
| Select/Popover/Dropdown | z-popover (300) | z-[9998] |
| Tooltip | z-[9999] | z-[9999] - sem mudanca |

## Risco

Baixo. Usar z-indexes muito altos e uma pratica comum para modais que DEVEM estar acima de tudo. O tooltip ja usa z-[9999], entao os modais ficam logo abaixo.

## Resultado Esperado

Modais aparecem SEMPRE acima de qualquer elemento da aplicacao, incluindo BottomNavigation, ChatPanel, backdrops, e qualquer outro elemento fixo.
