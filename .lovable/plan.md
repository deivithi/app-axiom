
# Fix Definitivo: Modal "Nova Transacao" - Abordagem Tripla

## Diagnostico

Apos investigacao profunda, identificamos que os fixes anteriores (remover `:root:not(.dark)`) estao corretos no codigo, mas o usuario continua com o problema. Ha tres possiveis causas restantes:

1. **Service Worker cache**: O cache name e `axiom-v1` e nunca foi atualizado. O Service Worker pode estar servindo o CSS antigo (com `:root:not(.dark)`) mesmo apos as mudancas no codigo.

2. **CSS Layer priority**: As regras `.modal-surface` estao dentro de `@layer components`. No CSS Layers, `!important` dentro de um layer tem MENOR prioridade que `!important` fora de qualquer layer. Se alguma regra nao-layered com `!important` existir (ou for adicionada pelo build), ela sobrescreve tudo.

3. **O DialogContent pode estar sendo renderizado mas com opacity/transform incorretos durante a animacao.**

## Solucao em 3 Partes

### Parte 1: Mover `.modal-surface` PARA FORA do `@layer components`

Mover as regras de `.modal-surface` para fora de qualquer `@layer`. Isso garante que elas tem a MAXIMA prioridade no CSS cascade (acima de qualquer layer).

**Arquivo:** `src/index.css`

- Remover `.modal-surface` e regras relacionadas de dentro do `@layer components` (linhas 356-393)
- Adicionar as mesmas regras ANTES do `@layer components`, como estilos "unlayered"

### Parte 2: Atualizar Service Worker cache version

**Arquivo:** `public/sw.js`

- Mudar `CACHE_NAME` de `'axiom-v1'` para `'axiom-v2'`
- Isso forca o SW a invalidar TODOS os caches antigos na proxima ativacao
- O evento `activate` ja limpa caches antigos automaticamente

### Parte 3: Manter inline styles nos componentes (redundancia)

Os inline styles ja adicionados em `dialog.tsx`, `drawer.tsx` e `alert-dialog.tsx` permanecem como backup.

## Detalhes Tecnicos

```text
Prioridade CSS com Layers (MAIOR para MENOR):
1. Unlayered !important        <-- NOVA posicao do .modal-surface
2. @layer components !important <-- posicao anterior
3. @layer utilities !important
4. Unlayered normal
5. @layer utilities normal
6. @layer components normal
7. @layer base normal
```

Ao mover para "unlayered !important", as regras ficam no topo absoluto da cascata. NADA pode sobrescreve-las exceto outro unlayered !important com especificidade maior.

### Mudancas Especificas

**src/index.css - Mover modal-surface PARA FORA do @layer:**

```css
/* MODAL SURFACE - FORA de @layer para maxima prioridade */
.modal-surface {
  background-color: hsl(230, 15%, 28%) !important;
  color: hsl(210, 40%, 98%) !important;
  opacity: 1 !important;
  border-color: rgba(148, 163, 184, 0.4) !important;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 
              0 0 0 1px rgba(255,255,255,0.1),
              inset 0 1px 0 rgba(255,255,255,0.05) !important;
}

.light .modal-surface {
  background-color: hsl(0, 0%, 100%) !important;
  border-color: hsl(214, 32%, 85%) !important;
  box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15),
              0 0 0 1px rgba(0,0,0,0.05) !important;
}

.modal-surface input,
.modal-surface [role="combobox"],
.modal-surface textarea,
.modal-surface select {
  background-color: hsl(230, 12%, 20%) !important;
  border-color: rgba(148, 163, 184, 0.3) !important;
  color: hsl(210, 40%, 98%) !important;
}

.light .modal-surface input,
.light .modal-surface [role="combobox"],
.light .modal-surface textarea,
.light .modal-surface select {
  background-color: hsl(0, 0%, 100%) !important;
  border-color: hsl(214, 32%, 91%) !important;
  color: hsl(222, 84%, 5%) !important;
}
```

**public/sw.js:**
- Linha 3: `const CACHE_NAME = 'axiom-v1';` -> `const CACHE_NAME = 'axiom-v2';`

## Por que DESTA VEZ vai funcionar

1. **Unlayered !important** e a regra de MAIOR prioridade possivel em CSS - nada a sobrescreve
2. **Cache invalidado** forca o browser a buscar o CSS novo
3. **Inline styles** nos componentes servem como backup triplo
4. **color explicito** nos inputs garante texto visivel
5. A combinacao de 3 camadas (unlayered CSS + inline styles + SW cache bust) elimina TODAS as causas possiveis

## Risco
Zero. Apenas reposicionamento de regras existentes + cache bust.
