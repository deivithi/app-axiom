

# Fix Definitivo: Bug Real Encontrado - `:root:not(.dark)` Override

## Causa Raiz (100% Confirmada)

O CSS tem esta regra na linha 369:
```css
:root:not(.dark) .modal-surface {
  background-color: hsl(0, 0%, 100%) !important;  /* BRANCO */
}
```

Como o `next-themes` remove a classe `dark` do `<html>`, o seletor `:root:not(.dark)` SEMPRE casa. Isso forca o modal a ter fundo BRANCO com `!important`.

O problema: `!important` em stylesheet tem prioridade MAIOR que inline styles. Entao nosso "fix nuclear" com `style={{ backgroundColor: ... }}` e completamente ignorado pelo browser.

Resultado final:
- Fundo do modal: BRANCO (da regra `:root:not(.dark)` com `!important`)
- Texto do modal: quase BRANCO (`hsl(210, 40%, 98%)` do inline style)
- Inputs: BRANCOS (mesma regra, linhas 388-398)
- Texto branco sobre fundo branco = **INVISIVEL** = "tela preta" (porque so se ve o overlay escuro)

## Solucao

Remover TODOS os seletores `:root:not(.dark)` das regras de modal. Agora que o dark mode e o padrao no `:root`, a unica forma de ativar light mode deve ser a classe `.light` (que o ThemeProvider adiciona explicitamente quando o usuario troca).

### Arquivo: `src/index.css`

**Mudanca 1** - Regra `.modal-surface` light override (linhas 368-376):
- Remover `:root:not(.dark) .modal-surface` do seletor
- Manter apenas `.light .modal-surface`

**Mudanca 2** - Regra de inputs light override (linhas 387-398):
- Remover todas as linhas `:root:not(.dark) .modal-surface input/combobox/textarea/select`
- Manter apenas as versoes `.light .modal-surface ...`

**Mudanca 3** - Buscar e remover QUALQUER outra ocorrencia de `:root:not(.dark)` no arquivo para prevenir bugs similares em outros componentes.

### Detalhes Tecnicos

```text
ANTES (bugado):
:root (sem .dark) + .modal-surface = fundo BRANCO !important
Inline style backgroundColor = IGNORADO (perde para !important)
Resultado: branco sobre branco = invisivel

DEPOIS (correto):
:root (sem .dark ou .light) + .modal-surface = fundo ESCURO !important
.light .modal-surface = fundo BRANCO (so quando usuario trocar tema)
Inline style = backup redundante
Resultado: modal escuro visivel
```

### Risco
Zero. A classe `.light` so e adicionada quando o usuario explicitamente troca para light mode via ThemeProvider. No modo padrao (dark), o modal usara o fundo escuro correto.

### Por que DESTA VEZ vai funcionar
Porque encontramos a causa raiz REAL: o seletor `:root:not(.dark)` estava ativando a regra de light mode com `!important`, sobrescrevendo ate mesmo inline styles. Remover esse seletor elimina o conflito de uma vez por todas.

