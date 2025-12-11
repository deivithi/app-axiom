import axiomLogo from '@/assets/axiom-logo.png';

export function AxiomTyping() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <img 
        src={axiomLogo} 
        alt="Axiom" 
        className="w-8 h-8 rounded-full flex-shrink-0 bg-background animate-pulse"
      />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-primary mb-1 ml-1">Axiom</span>
        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
          <div className="flex items-center gap-3">
            <img 
              src={axiomLogo} 
              alt="" 
              className="w-5 h-5 rounded-full animate-pulse"
            />
            <span className="text-sm text-muted-foreground">
              Axiom gerando sua resposta...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
