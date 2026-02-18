

# Fix Real: Tela Preta nos Modais - Problema de Contraste

## Causa Raiz Confirmada

O problema NAO e z-index (isso ja foi corrigido). O problema e **contraste insuficiente no dark mode**:

- Overlay: `bg-black/80` = rgba(0,0,0,0.8) -- quase preto
- DialogContent: `bg-card` = hsl(240 17% **9%**) -- tambem quase preto
- Border: `border-border/50` = hsl(240 6% **10%**) com 50% opacidade -- invisivel

Resultado: o modal abre mas e visualmente identico ao overlay. O usuario ve "tela preta".

## Solucao

### 1. DialogContent com fundo mais claro e borda visivel

**Arquivo:** `src/components/ui/dialog.tsx`

Mudancas:
- Background: `bg-card` -> `bg-popover` (hsl 240 14% 12% no dark mode -- 33% mais claro que card)
- Border: `border-border/50` -> `border-border-medium` (15% opacidade vs ~5%)
- Adicionar shadow forte: `shadow-2xl` para criar separacao visual do overlay
- Reduzir opacidade do overlay: `bg-black/80` -> `bg-black/60` para maior contraste

### 2. AlertDialogContent - mesma correcao

**Arquivo:** `src/components/ui/alert-dialog.tsx`

Mesmas mudancas de background, border e shadow.

### 3. DrawerContent - mesma correcao

**Arquivo:** `src/components/ui/drawer.tsx`

Aplicar `bg-popover` ao drawer tambem.

## Detalhes Tecnicos

Valores das variaveis CSS no dark mode:
- `--background`: hsl(240 20% 4%) = lightness 4% (quase preto)
- `--card`: hsl(240 17% 9%) = lightness 9% (muito escuro)
- `--popover`: hsl(240 14% 12%) = lightness 12% (escuro mas distinguivel)
- `--elevated-3`: hsl(240 12% 16%) = lightness 16% (mais claro ainda)

Usar `bg-popover` cria contraste real contra o overlay escuro. No light mode, popover e branco puro (0 0% 100%) entao nao ha mudanca visual.

## Mudancas Exatas

| Componente | Antes | Depois |
|------------|-------|--------|
| DialogOverlay | `bg-black/80` | `bg-black/60` |
| DialogContent bg | `bg-card` | `bg-popover` |
| DialogContent border | `border-border/50` | `border-border-medium` |
| DialogContent shadow | `shadow-lg` | `shadow-2xl` |
| AlertDialog Overlay | `bg-black/80` | `bg-black/60` |
| AlertDialog Content | mesmas mudancas | mesmas mudancas |

## Resultado Esperado

O modal "Nova Transacao" tera fundo visivelmente mais claro que o overlay escuro, com borda distinguivel e sombra que cria separacao visual. O usuario vera claramente o formulario sobre o fundo escurecido.

## Risco

Baixo. Apenas mudancas de cor/contraste. `bg-popover` ja e usado em SelectContent, PopoverContent e outros componentes com sucesso.

