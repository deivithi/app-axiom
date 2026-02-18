

# Fix Real: Classe `.dark` Nao Aplicada no HTML

## Causa Raiz (FINALMENTE encontrada)

O `<html>` tem `class=""` (vazio). O `next-themes` com `defaultTheme="dark"` e `attribute="class"` **nao esta aplicando** a classe `.dark` ao elemento `<html>`.

Consequencia: TODOS os CSS variables definidos dentro de `.dark { ... }` no `index.css` (linhas 274-358) NUNCA sao ativados. O browser usa os valores de `:root` que sao o **light mode**:
- `--foreground: 222 84% 5%` = texto quase preto
- `--background: 0 0% 100%` = fundo branco

Mas o `StarryBackground` renderiza um canvas escuro por cima. Resultado: texto escuro sobre fundo escuro = tudo invisivel = "tela preta".

Isso tambem explica por que `.dark .modal-surface` nunca funcionou e por que o `.glass` (CSS hardcoded) funcionava.

## Solucao

Duas mudancas simples:

### 1. `index.html` -- Adicionar `class="dark"` ao `<html>`

Isso garante que o dark mode esta ativo IMEDIATAMENTE, antes mesmo do JavaScript carregar. Se o `next-themes` funcionar depois, ele gerencia a classe normalmente. Se nao funcionar, o fallback ja esta la.

De: `<html lang="pt-BR">`
Para: `<html lang="pt-BR" class="dark">`

### 2. `src/App.tsx` -- Forcar `forcedTheme` ou adicionar script de seguranca

Adicionar `enableSystem={false}` e `storageKey="axiom-theme"` no ThemeProvider para evitar que localStorage com valor invalido sobrescreva o default. Tambem adicionar `disableTransitionOnChange` para evitar flash.

De:
```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
```
Para:
```tsx
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="axiom-theme" disableTransitionOnChange>
```

O `enableSystem={false}` impede que o `next-themes` tente detectar preferencia do sistema (que pode retornar "light" e remover a classe `.dark`). O `storageKey="axiom-theme"` usa uma chave dedicada para evitar conflitos.

## Por que vai funcionar

1. `class="dark"` no HTML = CSS variables dark mode ativos desde o primeiro render
2. `enableSystem={false}` = next-themes nao pode remover a classe baseado na preferencia do sistema
3. `defaultTheme="dark"` continua como fallback
4. Se o usuario trocar para light mode via ThemeToggle, next-themes substitui normalmente

## Arquivos a Modificar

1. `index.html` -- Adicionar `class="dark"` ao `<html>`
2. `src/App.tsx` -- Ajustar ThemeProvider props

## Risco

Zero. Adicionar `class="dark"` ao HTML e a forma recomendada pelo `next-themes` para evitar FOUC (Flash of Unstyled Content). E o `enableSystem={false}` apenas impede deteccao automatica do sistema.

## Impacto

Isso resolve NAO APENAS os modais, mas TODA a visibilidade do app. Texto, botoes, inputs, cards -- tudo volta a funcionar porque os CSS variables corretos (dark mode) serao finalmente aplicados.
