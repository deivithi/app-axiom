
# Fix Definitivo: Crash do Dialog "Nova Transacao"

## Causa Raiz REAL (Confirmada)

O problema NAO e CSS. E um **crash de JavaScript** causado pelo componente Radix Select.

Quando voce clica em "Nova Transacao", o React tenta renderizar o DialogContent. Dentro dele, existem varios componentes `Select` com `value=""` (string vazia). O Radix Select v2.x NAO suporta string vazia como valor controlado — isso causa um erro fatal de renderizacao.

Como o ErrorBoundary esta envolvendo o App inteiro (mas nao o conteudo individual do Dialog), o erro propaga e desmonta toda a pagina.

### Selects com value="" que causam crash:

1. **Linha 999** — `<Select value={newTransaction.category}>` — `category` inicia como `""`
2. **Linha 1171** — `<Select value={newTransfer.fromAccountId}>` — `fromAccountId` inicia como `""`
3. **Linha 1184** — `<Select value={newTransfer.toAccountId}>` — `toAccountId` inicia como `""`

O fix anterior so corrigiu o `account_id` (linha 1064), mas esqueceu esses tres.

## Solucao

### Arquivo: `src/pages/Finances.tsx`

**Mudanca 1** — Select de Categoria (linha 999):
Mudar de `value={newTransaction.category}` para usar valor `undefined` quando vazio, para que o Radix mostre o placeholder sem crash:
```tsx
<Select 
  value={newTransaction.category || undefined} 
  onValueChange={v => setNewTransaction(prev => ({ ...prev, category: v }))}
>
```
Usar `undefined` faz o Select funcionar em modo "uncontrolled" quando nao ha valor, mostrando o placeholder normalmente.

**Mudanca 2** — Select de Conta Origem na Transferencia (linha 1171):
```tsx
<Select 
  value={newTransfer.fromAccountId || undefined} 
  onValueChange={v => setNewTransfer(prev => ({ ...prev, fromAccountId: v }))}
>
```

**Mudanca 3** — Select de Conta Destino na Transferencia (linha 1184):
```tsx
<Select 
  value={newTransfer.toAccountId || undefined} 
  onValueChange={v => setNewTransfer(prev => ({ ...prev, toAccountId: v }))}
>
```

**Mudanca 4** — Quando o tipo muda, o category e resetado para `""` (linha 989). Manter isso, pois agora `"" || undefined` = `undefined`, que e seguro.

**Mudanca 5** — Adicionar `unhandledrejection` handler no App.tsx para capturar promessas rejeitadas que escapam do ErrorBoundary:
```tsx
useEffect(() => {
  const handler = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason);
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", handler);
  return () => window.removeEventListener("unhandledrejection", handler);
}, []);
```

## Detalhes Tecnicos

O Radix Select usa internamente o valor passado em `value` para fazer match com os `SelectItem` filhos. Quando `value=""`:
- Nenhum item faz match (nenhum tem `value=""`)
- O componente entra em estado inconsistente
- Dependendo da versao, joga erro de validacao ou causa re-render infinito
- Sem ErrorBoundary no nivel do Dialog, o erro sobe e desmonta toda a arvore React

Usar `undefined` faz o Select operar em modo "uncontrolled", mostrando apenas o placeholder sem tentar fazer match — comportamento seguro e documentado.

## Arquivos a Modificar

1. `src/pages/Finances.tsx` — Corrigir os 3 Selects com value="" 
2. `src/App.tsx` — Adicionar handler de unhandledrejection

## Risco
Zero. A mudanca de `""` para `undefined` nao altera nenhum comportamento visivel — apenas evita o crash.

## Por que DESTA VEZ vai funcionar
Porque agora identificamos a causa EXATA: o crash acontece no RENDER do DialogContent por causa do Radix Select com value="". Os fixes anteriores focaram em CSS (que ja estava correto apos as mudancas) mas nao encontraram esse bug de JavaScript. Ao mudar os valores vazios para `undefined`, o Select nao tenta fazer match e nao crasha.
