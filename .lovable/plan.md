
# Fix Real: `.modal-surface` Nao Depender da Classe `.dark`

## Causa Raiz Identificada

A classe `dark` **nao esta sendo aplicada ao elemento `<html>`** pelo `next-themes`. Confirmei isso via browser tool: `<html>` tem `class=""` (vazio).

Consequencia: `.dark .modal-surface` NUNCA aplica. O browser usa `.modal-surface` (sem prefixo) que tem `background-color: hsl(0, 0%, 100%)` (branco). Isso cria um conflito visual estranho com backdrop-blur e overlay.

## Solucao

Trocar a logica de cascata: o `.modal-surface` padrao (sem prefixo) deve ter as cores **escuras** (ja que o app e dark-first). E a versao light usa seletor mais especifico.

### Mudanca em `src/index.css` (unica mudanca necessaria)

De:
```css
.dark .modal-surface {
  background-color: hsl(230, 15%, 28%) !important;
  border-color: rgba(148, 163, 184, 0.4) !important;
  box-shadow: ... !important;
}
.modal-surface {
  background-color: hsl(0, 0%, 100%) !important;
  border-color: hsl(214, 32%, 85%) !important;
  box-shadow: ... !important;
}
.dark .modal-surface input, ...
```

Para:
```css
/* Default = dark (app e dark-first) */
.modal-surface {
  background-color: hsl(230, 15%, 28%) !important;
  border-color: rgba(148, 163, 184, 0.4) !important;
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}

/* Light mode override (quando .dark NAO esta presente ou :root light) */
:root:not(.dark) .modal-surface,
.light .modal-surface {
  background-color: hsl(0, 0%, 100%) !important;
  border-color: hsl(214, 32%, 85%) !important;
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05) !important;
}

/* Input contrast - default dark */
.modal-surface input,
.modal-surface [role="combobox"],
.modal-surface textarea,
.modal-surface select {
  background-color: hsl(230, 12%, 20%) !important;
  border-color: rgba(148, 163, 184, 0.3) !important;
}

/* Input contrast - light mode */
:root:not(.dark) .modal-surface input,
:root:not(.dark) .modal-surface [role="combobox"],
:root:not(.dark) .modal-surface textarea,
:root:not(.dark) .modal-surface select,
.light .modal-surface input,
.light .modal-surface [role="combobox"],
.light .modal-surface textarea,
.light .modal-surface select {
  background-color: hsl(0, 0%, 100%) !important;
  border-color: hsl(214, 32%, 91%) !important;
}
```

### Por que vai funcionar

- `.modal-surface` sem prefixo **sempre aplica** independente de `.dark` estar presente ou nao
- O default e escuro (cinza azulado 28% lightness) -- claramente visivel sobre overlay preto
- Se/quando `.dark` classe for aplicada pelo next-themes, nada muda (o default ja e escuro)
- Light mode usa `:root:not(.dark)` que so aplica se o usuario EXPLICITAMENTE trocar para claro
- Nenhum arquivo de componente precisa mudar -- `dialog.tsx`, `alert-dialog.tsx`, `drawer.tsx` ja usam `.modal-surface`

### Arquivos a Modificar

1. `src/index.css` -- Inverter a logica padrao/dark da `.modal-surface`

### Risco

Minimo. Apenas reorganiza quais estilos sao "default" vs "override". Mesmas cores, mesmos valores, mesma aparencia final.
