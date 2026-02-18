

# Fix Definitivo: Substituir Radix Dialog por Modal Customizado

## Diagnostico Real

Apos 4+ tentativas de corrigir o Dialog com Radix UI, o problema persiste. Todas as correcoes anteriores (Select values, CSS, animacoes, ErrorBoundary) nao resolveram. Isso indica que o problema pode estar no proprio Radix Dialog internamente - seja no Portal, no focus trap, ou em alguma interacao complexa com outros componentes da pagina.

**Abordagem nova: parar de tentar consertar o Radix Dialog e substituir por um modal customizado simples.**

## Solucao

### Parte 1: Criar componente SimpleModal

Criar um modal puro com HTML/CSS, sem depender do Radix Dialog. Sem Portal, sem focus trap, sem animacoes complexas. Apenas um overlay + caixa centralizada.

**Novo arquivo:** `src/components/ui/simple-modal.tsx`

```tsx
interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function SimpleModal({ open, onClose, title, children, footer }: SimpleModalProps) {
  if (!open) return null;
  
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9990 }}>
      {/* Overlay */}
      <div 
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
      />
      {/* Content */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '28rem',
        maxHeight: '85vh', overflowY: 'auto',
        backgroundColor: 'hsl(230, 15%, 28%)',
        color: 'hsl(210, 40%, 98%)',
        borderRadius: '0.5rem',
        padding: '1.5rem',
        zIndex: 9995,
      }}>
        <h2>{title}</h2>
        <button onClick={onClose}>X</button>
        {children}
        {footer}
      </div>
    </div>
  );
}
```

### Parte 2: Substituir Dialog por SimpleModal no formulario "Nova Transacao"

No `src/pages/Finances.tsx`, substituir o `<Dialog>` que envolve "Nova Transacao" pelo novo `<SimpleModal>`. O botao continua igual, mas ao clicar ele abre o SimpleModal em vez do Radix Dialog.

Mudancas:
- Remover `<Dialog open={isDialogOpen}...>`, `<DialogTrigger>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogFooter>`
- Usar `<SimpleModal open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Nova Transacao">`
- Manter o conteudo interno (inputs, selects, switches) IDENTICO
- O botao "Nova Transacao" muda de `<DialogTrigger>` para um `<Button onClick={() => setIsDialogOpen(true)}>`

### Parte 3: Adicionar console.log de diagnostico

Adicionar um `console.log` dentro do render do SimpleModal para confirmar que ele esta sendo chamado. Isso ajuda a debugar se houver algum problema residual.

### Parte 4: Manter os outros Dialogs como estao

Os dialogs de "Nova Conta", "Transferencia" e "Editar Transacao" continuam usando Radix Dialog. Se funcionarem, otimo. Se nao, podemos migra-los depois.

## Detalhes Tecnicos

O SimpleModal:
- Usa `if (!open) return null` - nao renderiza NADA quando fechado
- Nao usa React Portal - renderiza inline no componente
- Nao usa animacoes CSS que possam travar em opacity:0
- Usa SOMENTE inline styles - zero dependencia de CSS externo
- Nao tem focus trap ou escape handler complexo (pode ser adicionado depois)
- Fecha ao clicar no overlay ou no botao X

Isso elimina TODAS as possiveis causas de crash: Portals, CSS Layers, animacoes, focus trapping, Radix internals.

## Arquivos a Modificar

1. `src/components/ui/simple-modal.tsx` (NOVO) - Modal customizado
2. `src/pages/Finances.tsx` - Substituir Dialog por SimpleModal no formulario "Nova Transacao"

## Risco
Minimo. O modal tera a mesma aparencia visual (fundo escuro, borda, inputs). A unica diferenca e que nao tera animacao de entrada/saida e nao tera focus trap automatico. A funcionalidade do formulario permanece 100% identica.

