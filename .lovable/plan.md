

# Auditoria Completa: Problemas Encontrados em TODAS as Paginas

## Resultado da Analise

Apos inspecionar cada pagina, identifiquei que o MESMO padrao que causava a "tela preta" na pagina de Financas existe em TODAS as outras paginas. Especificamente:

## Problemas Encontrados

### 1. Execution.tsx (590 linhas)
- Usa Radix Dialog (4 instancias) e Radix Select (3 instancias)
- 11 funcoes async SEM try-catch: `loadTasks`, `loadProjects`, `loadProjectTasks`, `createTask`, `updateTask`, `deleteTask`, `updateTaskStatus`, `createProject`, `updateProject`, `deleteProject`, `addProjectTask`, `toggleProjectTask`, `deleteProjectTask`, `updateProjectProgress`
- SEM ErrorBoundary local
- Risco: qualquer erro async ou render derruba a pagina inteira

### 2. Habits.tsx (408 linhas)
- Usa Radix Dialog (2 instancias) e Radix Select (2 instancias)
- 3 funcoes async SEM try-catch: `toggleHabitDay`, `deleteHabit`, `loadLogs`
- SEM ErrorBoundary local

### 3. Memory.tsx (481 linhas)
- Usa Radix Dialog (1 instancia)
- 6 funcoes async SEM try-catch completo: `createNote`, `updateNote`, `togglePin`, `deleteNote`, `saveJournalEntry`, `deleteJournalEntry`
- SEM ErrorBoundary local

### 4. Settings.tsx (816 linhas)
- Usa Radix Dialog (2 instancias)
- Varias funcoes async parcialmente protegidas
- SEM ErrorBoundary local

### 5. Intelligence.tsx (616 linhas)
- Funcoes async para carregar dados e gerar insights
- SEM ErrorBoundary local

## Plano de Hardening: 3 Acoes por Pagina

Para CADA uma das 5 paginas, aplicar o mesmo padrao que resolveu definitivamente o problema em Finances:

### Acao 1: ErrorBoundary Local em cada pagina

Adicionar um ErrorBoundary especifico (class component) em cada pagina, identico ao `FinancesErrorBoundary`, que:
- Captura erros de render antes que cheguem ao ErrorBoundary global
- Mostra mensagem de erro clara com borda vermelha (nunca "tela preta")
- Oferece botoes "Tentar novamente" e "Voltar ao inicio"
- Exibe stack trace para debug

Paginas que receberao ErrorBoundary:
- `Execution.tsx` -> `ExecutionErrorBoundary`
- `Habits.tsx` -> `HabitsErrorBoundary`
- `Memory.tsx` -> `MemoryErrorBoundary`
- `Settings.tsx` -> `SettingsErrorBoundary`
- `Intelligence.tsx` -> `IntelligenceErrorBoundary`

### Acao 2: Try-catch em TODAS as funcoes async

Envolver cada funcao async sem protecao com try-catch padrao:

```tsx
const nomeDaFuncao = async (...) => {
  try {
    // codigo existente
  } catch (error) {
    console.error("[NomeDaPagina] Erro em nomeDaFuncao:", error);
    toast({ title: "Erro", description: "Erro inesperado. Tente novamente.", variant: "destructive" });
  }
};
```

Funcoes a proteger por pagina:
- **Execution**: ~14 funcoes (loadTasks, createTask, updateTask, deleteTask, etc.)
- **Habits**: ~3 funcoes (toggleHabitDay, deleteHabit, loadLogs)
- **Memory**: ~6 funcoes (createNote, updateNote, deleteNote, etc.)
- **Settings**: revisar e completar protecoes parciais
- **Intelligence**: ~6 funcoes (loadSummary, loadScore, loadScoreHistory, etc.)

### Acao 3: Null-safe rendering no JSX

Adicionar verificacoes defensivas em pontos de renderizacao que podem falhar:
- Chamadas a `format()` do date-fns com datas potencialmente null
- Acesso a propriedades de objetos que podem ser undefined
- Operacoes `.toLowerCase()` em strings potencialmente null

## Arquivos a Modificar

1. `src/pages/Execution.tsx` - ErrorBoundary + try-catch em ~14 funcoes
2. `src/pages/Habits.tsx` - ErrorBoundary + try-catch em ~3 funcoes
3. `src/pages/Memory.tsx` - ErrorBoundary + try-catch em ~6 funcoes
4. `src/pages/Settings.tsx` - ErrorBoundary + try-catch em funcoes desprotegidas
5. `src/pages/Intelligence.tsx` - ErrorBoundary + try-catch em ~6 funcoes

## O que NAO vamos mudar

- Os componentes Radix Dialog/Select nas outras paginas NAO serao substituidos agora. Na pagina de Financas, o problema era especifico (muitos modais + selects complexos + re-renders pesados). As outras paginas tem dialogs mais simples.
- O ErrorBoundary local e suficiente para capturar qualquer erro que o Radix possa causar e mostrar uma UI de recuperacao em vez de tela preta.

## Resultado Esperado

Apos estas mudancas, a aplicacao tera:
- 6 paginas com ErrorBoundary local (Finances ja tem + 5 novas)
- 1 ErrorBoundary global (App.tsx) como ultima linha de defesa
- ~40+ funcoes async protegidas com try-catch
- Zero possibilidade de "tela preta" em qualquer pagina
- Mensagens de erro claras e acionaveis para o usuario

## Detalhes Tecnicos

O ErrorBoundary sera um componente reutilizavel criado uma unica vez e importado em todas as paginas:

```tsx
// src/components/PageErrorBoundary.tsx (NOVO arquivo)
class PageErrorBoundary extends React.Component<
  { children: React.ReactNode; pageName: string },
  { hasError: boolean; error: Error | null }
> {
  // ... mesma logica do FinancesErrorBoundary
  // mas com prop pageName para identificar qual pagina falhou
}
```

Isso evita duplicacao de codigo e centraliza a logica de erro.

## Risco

Zero. Adicionar try-catch e ErrorBoundary nao altera nenhuma funcionalidade existente. Apenas adiciona protecao contra crashes.

