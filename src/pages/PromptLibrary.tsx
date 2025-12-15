import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, Pin, PinOff, Search, Sparkles, Copy, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Prompt {
  id: string;
  title: string;
  prompt_text: string;
  category: string;
  ai_diagnosis: string | null;
  optimized_prompt: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['geral', 'escrita', 'código', 'análise', 'criativo', 'negócios', 'outros'];

export default function PromptLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({ title: '', prompt_text: '', category: 'geral' });
  const [editPrompt, setEditPrompt] = useState({ title: '', prompt_text: '', category: 'geral' });
  const [generatingDiagnosis, setGeneratingDiagnosis] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadPrompts();
  }, [user]);

  const loadPrompts = async () => {
    const { data, error } = await supabase
      .from('prompt_library')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar prompts', variant: 'destructive' });
    } else {
      setPrompts((data || []) as Prompt[]);
    }
    setLoading(false);
  };

  const generateDiagnosis = async (promptId: string, promptText: string) => {
    if (promptText.trim().length < 10) return;
    
    setGeneratingDiagnosis(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_context, full_name')
        .eq('id', user?.id)
        .single();

      const response = await supabase.functions.invoke('analyze-content', {
        body: {
          content: promptText,
          type: 'prompt',
          userContext: profile?.user_context,
          userName: profile?.full_name,
        }
      });

      if (response.data?.insights) {
        await supabase
          .from('prompt_library')
          .update({ 
            ai_diagnosis: response.data.insights,
            optimized_prompt: response.data.optimizedPrompt || null
          })
          .eq('id', promptId);
        
        loadPrompts();
        toast({ title: '✨ Diagnóstico gerado!', description: 'Axiom analisou seu prompt' });
      }
    } catch (error) {
      console.error('Error generating diagnosis:', error);
    } finally {
      setGeneratingDiagnosis(false);
    }
  };

  const createPrompt = async () => {
    if (!newPrompt.title.trim() || !newPrompt.prompt_text.trim()) return;

    const { data, error } = await supabase.from('prompt_library').insert({
      user_id: user?.id,
      title: newPrompt.title,
      prompt_text: newPrompt.prompt_text,
      category: newPrompt.category,
    }).select().single();

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar prompt', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Prompt criado!' });
      setNewPrompt({ title: '', prompt_text: '', category: 'geral' });
      setDialogOpen(false);
      loadPrompts();
      
      if (data) {
        generateDiagnosis(data.id, newPrompt.prompt_text);
      }
    }
  };

  const updatePrompt = async () => {
    if (!selectedPrompt || !editPrompt.title.trim() || !editPrompt.prompt_text.trim()) return;

    const { error } = await supabase
      .from('prompt_library')
      .update({ 
        title: editPrompt.title, 
        prompt_text: editPrompt.prompt_text,
        category: editPrompt.category
      })
      .eq('id', selectedPrompt.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Prompt atualizado!' });
      setEditDialogOpen(false);
      loadPrompts();
      
      // Regenerate diagnosis if content changed
      if (editPrompt.prompt_text !== selectedPrompt.prompt_text) {
        generateDiagnosis(selectedPrompt.id, editPrompt.prompt_text);
      }
    }
  };

  const openEditDialog = (prompt: Prompt) => {
    setEditPrompt({
      title: prompt.title,
      prompt_text: prompt.prompt_text,
      category: prompt.category
    });
    setSelectedPrompt(prompt);
    setEditDialogOpen(true);
  };

  const regenerateDiagnosis = async () => {
    if (selectedPrompt) {
      generateDiagnosis(selectedPrompt.id, selectedPrompt.prompt_text);
    }
  };

  const togglePin = async (prompt: Prompt) => {
    await supabase.from('prompt_library').update({ is_pinned: !prompt.is_pinned }).eq('id', prompt.id);
    loadPrompts();
  };

  const deletePrompt = async (id: string) => {
    await supabase.from('prompt_library').delete().eq('id', id);
    setSelectedPrompt(null);
    loadPrompts();
    toast({ title: 'Prompt excluído' });
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '📋 Copiado!', description: 'Prompt copiado para a área de transferência' });
  };

  const filteredPrompts = prompts.filter(
    (p) =>
      p.prompt_text.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedPrompts = filteredPrompts.filter((p) => p.is_pinned);
  const otherPrompts = filteredPrompts.filter((p) => !p.is_pinned);

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Biblioteca de Prompts</h1>
            <p className="text-muted-foreground">Salve e organize seus melhores prompts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Novo Prompt</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={newPrompt.title}
                    onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                    placeholder="Nome do prompt"
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={newPrompt.category} onValueChange={(v) => setNewPrompt({ ...newPrompt, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prompt</Label>
                  <Textarea
                    value={newPrompt.prompt_text}
                    onChange={(e) => setNewPrompt({ ...newPrompt, prompt_text: e.target.value })}
                    placeholder="Cole ou escreva seu prompt aqui..."
                    className="min-h-[200px]"
                  />
                </div>
                <Button onClick={createPrompt} className="w-full">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input
                  value={editPrompt.title}
                  onChange={(e) => setEditPrompt({ ...editPrompt, title: e.target.value })}
                  placeholder="Nome do prompt"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editPrompt.category} onValueChange={(v) => setEditPrompt({ ...editPrompt, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prompt</Label>
                <Textarea
                  value={editPrompt.prompt_text}
                  onChange={(e) => setEditPrompt({ ...editPrompt, prompt_text: e.target.value })}
                  placeholder="Cole ou escreva seu prompt aqui..."
                  className="min-h-[200px]"
                />
              </div>
              <Button onClick={updatePrompt} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prompts..."
            className="pl-10"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {pinnedPrompts.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Fixados
                  </h3>
                  <div className="space-y-2">
                    {pinnedPrompts.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        onSelect={() => setSelectedPrompt(prompt)}
                        onTogglePin={() => togglePin(prompt)}
                        onDelete={() => deletePrompt(prompt.id)}
                        onCopy={() => copyPrompt(prompt.prompt_text)}
                        onEdit={() => openEditDialog(prompt)}
                        isSelected={selectedPrompt?.id === prompt.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                {pinnedPrompts.length > 0 && (
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Outros prompts</h3>
                )}
                {otherPrompts.length === 0 && pinnedPrompts.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    Nenhum prompt encontrado
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {otherPrompts.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        onSelect={() => setSelectedPrompt(prompt)}
                        onTogglePin={() => togglePin(prompt)}
                        onDelete={() => deletePrompt(prompt.id)}
                        onCopy={() => copyPrompt(prompt.prompt_text)}
                        onEdit={() => openEditDialog(prompt)}
                        isSelected={selectedPrompt?.id === prompt.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-6 h-fit space-y-4">
              {selectedPrompt ? (
                <>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">{selectedPrompt.title}</h2>
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                          {selectedPrompt.category}
                        </span>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <pre className="whitespace-pre-wrap text-sm font-mono">
                          {selectedPrompt.prompt_text}
                        </pre>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Criado em {format(new Date(selectedPrompt.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => copyPrompt(selectedPrompt.prompt_text)}>
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Diagnóstico da IA */}
                  {generatingDiagnosis ? (
                    <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Axiom analisando o prompt...</span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : selectedPrompt.ai_diagnosis ? (
                    <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Diagnóstico do Axiom</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={regenerateDiagnosis}
                            className="text-xs"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Regenerar
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedPrompt.ai_diagnosis}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed border-primary/30">
                      <CardContent className="p-4 text-center">
                        <Button
                          variant="ghost"
                          onClick={regenerateDiagnosis}
                          className="text-muted-foreground"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Gerar diagnóstico com Axiom
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Prompt Otimizado */}
                  {selectedPrompt.optimized_prompt && (
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-500">Prompt Otimizado</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyPrompt(selectedPrompt.optimized_prompt!)}
                            className="text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar
                          </Button>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <pre className="whitespace-pre-wrap text-sm font-mono">
                            {selectedPrompt.optimized_prompt}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Selecione um prompt para visualizar
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function PromptCard({
  prompt,
  onSelect,
  onTogglePin,
  onDelete,
  onCopy,
  onEdit,
  isSelected,
}: {
  prompt: Prompt;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onEdit: () => void;
  isSelected: boolean;
}) {
  return (
    <Card
      className={cn('cursor-pointer transition-colors', isSelected && 'ring-2 ring-primary')}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{prompt.title}</p>
              {prompt.ai_diagnosis && (
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{prompt.prompt_text}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {prompt.category}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(prompt.created_at), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              {prompt.is_pinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
