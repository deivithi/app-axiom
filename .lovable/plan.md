

# Fix Definitivo: Inverter CSS Variables (Dark = Default)

## Problema Real Confirmado

Testei via browser: `<html>` tem `class=""` (vazio) MESMO depois de colocar `class="dark"` no HTML. O `next-themes` esta ativamente removendo a classe ao montar o React.

Consequencia: `.dark { --background: 240 20% 4% }` NUNCA aplica. O browser usa `:root { --background: 0 0% 100% }` (branco). Todo o app renderiza com cores de light mode sobre um fundo escuro do StarryBackground = tela preta.

## Solucao: Dark como Default no CSS

Trocar a logica do CSS: o `:root` define os valores DARK (que sao os que o app usa 99% do tempo). Os valores light ficam sob `.light` (usado apenas se o usuario trocar explicitamente).

Isso elimina TODA dependencia da classe `.dark` no `<html>`. O app funciona escuro por padrao, independente do que o `next-themes` faz.

## Mudancas

### 1. `src/index.css` - Inverter os tokens

**De:**
```
@layer base {
  :root { /* LIGHT values */ }
  .dark { /* DARK values */ }
}
```

**Para:**
```
@layer base {
  :root { /* DARK values (default) */ }
  .light { /* LIGHT values (override) */ }
}
```

Os valores nao mudam -- apenas trocam de lugar. O `:root` recebe os dark values, e os light values vao para `.light`.

### 2. `src/App.tsx` - ThemeProvider usa `"light"` como classe alternativa

O ThemeProvider ja esta correto com `attribute="class"`. Quando o usuario trocar para light mode, ele aplica `.light` no HTML, ativando os overrides. Sem mudanca necessaria aqui.

### 3. `index.html` - Manter `class="dark"` como fallback

Manter o `class="dark"` no HTML como fallback para componentes que usam `.dark` diretamente (como o Tailwind `dark:` prefix).

## Detalhes Tecnicos

### Tokens que serao movidos para `:root` (atualmente em `.dark`)
- `--background: 240 20% 4%` (preto profundo)
- `--foreground: 210 40% 98%` (texto claro)
- `--card: 240 17% 9%`
- `--popover: 240 14% 12%`
- `--modal: 230 15% 28%`
- `--primary`, `--secondary`, `--accent` (dark variants)
- `--border`, `--input`, `--ring`
- `--glass-bg`, `--glass-border`
- `--sidebar-*`

### Tokens que serao movidos para `.light` (atualmente em `:root`)
- `--background: 0 0% 100%` (branco)
- `--foreground: 222 84% 5%` (texto escuro)
- Todos os equivalentes light

### Impacto no Tailwind `dark:` prefix
O Tailwind usa `.dark` para o prefixo `dark:`. Se algum componente usar `dark:bg-something`, ele nao sera afetado porque ja temos `class="dark"` no HTML. Alem disso, como o `:root` agora TEM os valores dark, usar `bg-background` diretamente (sem `dark:` prefix) ja retorna a cor correta.

### Classe `.modal-surface` 
Ja funciona independente porque tem valores hardcoded. Nenhuma mudanca necessaria.

## Arquivos a Modificar

1. `src/index.css` -- Trocar os blocos `:root` (light) e `.dark` (dark) de lugar

## Risco

Minimo. Apenas reorganiza ONDE os tokens estao definidos. As mesmas cores continuam ativas. O app ja e 100% dark-first, entao isso alinha o CSS com a realidade.

## Resultado Esperado

- App renderiza corretamente no dark mode SEM depender de `.dark` no HTML
- Light mode funciona quando o usuario trocar (ThemeProvider adiciona `.light`)
- Todos os modais, cards, textos, inputs ficam visiveis imediatamente
- Elimina a "tela preta" de uma vez por todas
