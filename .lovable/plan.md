
# Fix Definitivo: Tela Preta em Modais e Popups

## Causa Raiz Identificada

O problema NAO era apenas o Dialog. Existem **7 componentes UI** que ainda usam `z-50` (o padrao do Radix UI), enquanto o sistema de z-index do projeto usa valores muito maiores:

```text
z-50   <-- Select, Popover, Dropdown, Drawer, ContextMenu, HoverCard, Menubar
z-150  <-- BottomNavigation (z-fixed)
z-200  <-- Dialog Overlay (z-modal-backdrop)
z-250  <-- Dialog Content (z-modal)
z-300  <-- Popover (z-popover) - ONDE DEVERIA ESTAR
```

Quando o usuario abre um Dialog (z-200/z-250) e depois interage com um Select, Popover ou Dropdown DENTRO do dialog, o conteudo desses componentes renderiza em z-50 -- ATRAS do overlay do Dialog em z-200. Resultado: tela preta.

O Drawer tambem usa z-50, entao se qualquer componente usar um Drawer no mobile, ele ficaria atras da BottomNavigation (z-150).

## Solucao Completa

Atualizar TODOS os 7 componentes para usar a escala de z-index correta do projeto:

### 1. `src/components/ui/select.tsx`
- `SelectContent`: z-50 -> z-popover (300)

### 2. `src/components/ui/popover.tsx`
- `PopoverContent`: z-50 -> z-popover (300)

### 3. `src/components/ui/dropdown-menu.tsx`
- `DropdownMenuContent`: z-50 -> z-popover (300)
- `DropdownMenuSubContent`: z-50 -> z-popover (300)

### 4. `src/components/ui/context-menu.tsx`
- `ContextMenuContent`: z-50 -> z-popover (300)
- `ContextMenuSubContent`: z-50 -> z-popover (300)

### 5. `src/components/ui/hover-card.tsx`
- `HoverCardContent`: z-50 -> z-popover (300)

### 6. `src/components/ui/drawer.tsx`
- `DrawerOverlay`: z-50 -> z-modal-backdrop (200)
- `DrawerContent`: z-50 -> z-modal (250)

### 7. `src/components/ui/menubar.tsx`
- `MenubarContent`: z-50 -> z-popover (300)
- `MenubarSubContent`: z-50 -> z-popover (300)

## Escala Final Corrigida

```text
z-fixed (150)          BottomNavigation
z-modal-backdrop (200) Dialog Overlay, Drawer Overlay, Chat Backdrop
z-modal (250)          Dialog Content, Drawer Content, ChatPanel
z-popover (300)        Select, Popover, Dropdown, ContextMenu, HoverCard, Menubar
z-toast (400)          Toast notifications
z-tooltip (500)        Tooltips (ja correto com z-[9999])
```

## Resultado Esperado

- Clicar "Nova Transacao" mostra o formulario corretamente
- Selects e dropdowns DENTRO de dialogs ficam visiveis acima do overlay
- Drawers no mobile ficam acima da BottomNavigation
- Nenhuma tela preta em nenhum cenario

## Risco

Baixo - apenas substituicao de z-50 por classes do design system ja existente. Sem mudanca de logica.
