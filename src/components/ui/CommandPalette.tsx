import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Brain,
    Target,
    Repeat,
    DollarSign,
    BookOpen,
    MessageSquare,
    Settings,
    Search,
    Sparkles,
    Plus,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    shortcut?: string;
    action: () => void;
    category: string;
}

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Definição das ações disponíveis
    const items: CommandItem[] = useMemo(() => [
        // Navegação
        { id: 'intelligence', label: 'Motor de Inteligência', description: 'Score e insights da IA', icon: <Brain className="w-4 h-4" />, shortcut: 'Alt+1', action: () => navigate('/intelligence'), category: 'Navegação' },
        { id: 'execution', label: 'Sistema de Execução', description: 'Tarefas e projetos', icon: <Target className="w-4 h-4" />, shortcut: 'Alt+2', action: () => navigate('/execution'), category: 'Navegação' },
        { id: 'habits', label: 'Hábitos', description: 'Rotinas e tracking', icon: <Repeat className="w-4 h-4" />, shortcut: 'Alt+3', action: () => navigate('/habits'), category: 'Navegação' },
        { id: 'finances', label: 'Finanças', description: 'Transações e contas', icon: <DollarSign className="w-4 h-4" />, shortcut: 'Alt+4', action: () => navigate('/finances'), category: 'Navegação' },
        { id: 'memory', label: 'Segunda Memória', description: 'Notas e diário', icon: <BookOpen className="w-4 h-4" />, shortcut: 'Alt+5', action: () => navigate('/memory'), category: 'Navegação' },
        { id: 'chat', label: 'Chat com Axiom', description: 'Conversar com a IA', icon: <MessageSquare className="w-4 h-4" />, action: () => navigate('/chat'), category: 'Navegação' },
        { id: 'settings', label: 'Configurações', description: 'Preferências do app', icon: <Settings className="w-4 h-4" />, shortcut: 'Alt+S', action: () => navigate('/settings'), category: 'Navegação' },
        // Ações rápidas
        { id: 'new-transaction', label: 'Nova Transação', description: 'Adicionar receita ou despesa', icon: <Plus className="w-4 h-4" />, action: () => navigate('/finances'), category: 'Ações Rápidas' },
        { id: 'ask-ai', label: 'Perguntar à IA', description: 'Abrir chat com pergunta', icon: <Sparkles className="w-4 h-4" />, action: () => navigate('/chat'), category: 'Ações Rápidas' },
    ], [navigate]);

    // Filtrar itens por busca fuzzy
    const filteredItems = useMemo(() => {
        if (!query.trim()) return items;
        const lowerQuery = query.toLowerCase();
        return items.filter(
            item =>
                item.label.toLowerCase().includes(lowerQuery) ||
                item.description?.toLowerCase().includes(lowerQuery) ||
                item.category.toLowerCase().includes(lowerQuery)
        );
    }, [items, query]);

    // Agrupar por categoria
    const groupedItems = useMemo(() => {
        const groups: Record<string, CommandItem[]> = {};
        filteredItems.forEach(item => {
            if (!groups[item.category]) groups[item.category] = [];
            groups[item.category].push(item);
        });
        return groups;
    }, [filteredItems]);

    // Reset ao abrir/fechar
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [open]);

    // Navegação por teclado
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
            e.preventDefault();
            filteredItems[selectedIndex].action();
            onOpenChange(false);
        } else if (e.key === 'Escape') {
            onOpenChange(false);
        }
    }, [filteredItems, selectedIndex, onOpenChange]);

    // Reset index quando query muda
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    if (!open) return null;

    let flatIndex = -1;

    return (
        <div
            className="fixed inset-0 z-[9999] command-palette-overlay flex items-start justify-center pt-[20vh]"
            onClick={() => onOpenChange(false)}
            aria-label="Command Palette"
            role="dialog"
        >
            <div
                className="command-palette-container w-full max-w-lg mx-4 animate-slide-in-right"
                onClick={e => e.stopPropagation()}
                style={{ animationName: 'none', animation: 'slide-in-bottom 0.2s var(--ease-spring)' }}
            >
                {/* Input de busca */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        placeholder="Buscar páginas, ações..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="command-palette-input !border-0 !p-0 !text-base"
                        autoFocus
                    />
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-1 rounded-md hover:bg-muted transition-colors"
                        aria-label="Fechar"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Lista de resultados */}
                <div className="max-h-[300px] overflow-y-auto py-2">
                    {Object.entries(groupedItems).map(([category, categoryItems]) => (
                        <div key={category}>
                            <div className="px-5 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {category}
                            </div>
                            {categoryItems.map((item) => {
                                flatIndex++;
                                const itemIndex = flatIndex;
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            'command-palette-item',
                                            itemIndex === selectedIndex && 'bg-primary/8'
                                        )}
                                        onClick={() => {
                                            item.action();
                                            onOpenChange(false);
                                        }}
                                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                                        role="option"
                                        aria-selected={itemIndex === selectedIndex}
                                    >
                                        <div className="command-palette-item-icon">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-foreground">{item.label}</div>
                                            {item.description && (
                                                <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                            )}
                                        </div>
                                        {item.shortcut && (
                                            <span className="command-palette-shortcut">{item.shortcut}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}

                    {filteredItems.length === 0 && (
                        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                            Nenhum resultado para "{query}"
                        </div>
                    )}
                </div>

                {/* Footer com dica */}
                <div className="px-5 py-2.5 border-t border-border/50 flex items-center gap-4 text-[11px] text-muted-foreground/60">
                    <span>↑↓ Navegar</span>
                    <span>↵ Selecionar</span>
                    <span>Esc Fechar</span>
                </div>
            </div>

            <style>{`
        @keyframes slide-in-bottom {
          from { transform: translateY(-20px) scale(0.96); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
