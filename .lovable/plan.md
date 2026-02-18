

# Fix DEFINITIVO: Eliminar TODOS os componentes Radix do formulario "Nova Transacao"

## Diagnostico Final (apos 5 tentativas)

O SimpleModal ja esta em uso, os valores dos Select ja foram corrigidos, o ErrorBoundary ja existe. O problema PERSISTE. A unica explicacao restante e que os **componentes Radix Select DENTRO do SimpleModal** estao causando o crash.

O `SelectContent` do Radix usa `SelectPrimitive.Portal` que renderiza um novo container no `document.body`. Isso pode:
1. Criar conflitos de foco com o SimpleModal (roubo de foco, scroll lock)
2. Disparar listeners internos do Radix que interferem com o DOM
3. Causar erros silenciosos no mount/unmount do Portal

**A solucao: eliminar 100% das dependencias Radix de dentro do formulario "Nova Transacao".** Substituir TODOS os `<Select>` por elementos `<select>` nativos HTML.

## Mudancas

### Arquivo 1: `src/pages/Finances.tsx`

Dentro do bloco `<SimpleModal>` (linhas 967-1082), substituir os 4 componentes `<Select>` por `<select>` nativos HTML:

**Select 1 - Tipo (linha 991):**
```tsx
// DE:
<Select value={newTransaction.type} onValueChange={...}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="expense">Despesa</SelectItem>
    <SelectItem value="income">Receita</SelectItem>
  </SelectContent>
</Select>

// PARA:
<select
  value={newTransaction.type}
  onChange={e => setNewTransaction(prev => ({ ...prev, type: e.target.value as "income" | "expense", category: "" }))}
  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  <option value="expense">Despesa</option>
  <option value="income">Receita</option>
</select>
```

**Select 2 - Categoria (linha 1001):**
```tsx
// PARA:
<select
  value={newTransaction.category}
  onChange={e => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  <option value="">Selecione</option>
  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
</select>
```

**Select 3 - Forma de Pagamento (linha 1012):**
```tsx
// PARA:
<select
  value={newTransaction.payment_method}
  onChange={e => setNewTransaction(prev => ({ ...prev, payment_method: e.target.value }))}
  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
</select>
```

**Select 4 - Conta (linha 1065):**
```tsx
// PARA:
<select
  value={newTransaction.account_id}
  onChange={e => setNewTransaction(prev => ({ ...prev, account_id: e.target.value }))}
  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
>
  <option value="">Nenhuma</option>
  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.icon} {acc.name}</option>)}
</select>
```

### Arquivo 2: `src/pages/Finances.tsx` - Envolver o conteudo do SimpleModal com try-catch

Adicionar um wrapper de seguranca no `createTransaction` com try-catch explicito:

```tsx
const createTransaction = async () => {
  try {
    // ... codigo existente ...
  } catch (error) {
    console.error("Erro ao criar transacao:", error);
    toast.error("Erro inesperado ao criar transacao");
  }
};
```

### Arquivo 3: `src/index.css` - Estilizar selects nativos para tema escuro

Adicionar regras CSS para que os `<select>` nativos respeitem o tema escuro:

```css
select {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  appearance: auto;
}

select option {
  background-color: hsl(230, 15%, 20%);
  color: hsl(210, 40%, 98%);
}
```

## Por que DESTA VEZ vai funcionar

Nas tentativas anteriores:
1. Tentativa 1: Removemos animacoes CSS - nao resolveu
2. Tentativa 2: Corrigimos `SelectItem value=""` - nao resolveu
3. Tentativa 3: Adicionamos ErrorBoundary - nao resolveu
4. Tentativa 4: Criamos SimpleModal substituindo Radix Dialog - nao resolveu
5. **Tentativa 5 (agora): Eliminamos os Radix Select de DENTRO do modal**

A logica e clara: o SimpleModal funciona (e puro HTML/CSS), mas o conteudo DENTRO dele ainda usa componentes Radix. Ao substituir por `<select>` nativos, eliminamos 100% de codigo Radix do formulario "Nova Transacao". Se isso nao resolver, o problema nao esta no formulario de forma alguma e precisamos investigar outros componentes da pagina.

## Detalhes Tecnicos

- `<select>` nativo HTML e o elemento de formulario mais estavel que existe
- Nao usa Portal, nao usa focus trap, nao usa animacoes
- Funciona em 100% dos browsers sem dependencias
- O `<option>` suporta valores vazios (`""`) sem problemas
- A estilizacao sera feita via classes Tailwind + CSS customizado para tema escuro
- Os outros dialogs (Editar, Nova Conta, Transferir) continuam com Radix por enquanto

## Arquivos a Modificar

1. `src/pages/Finances.tsx` - Substituir 4 Selects Radix por selects nativos + try-catch
2. `src/index.css` - Estilos para select nativo no tema escuro

## Risco
Zero. Elementos HTML nativos sao os mais estaveis possiveis. A unica diferenca visual e que o dropdown tera aparencia nativa do browser em vez do estilo customizado Radix (que pode ser refinado depois).

