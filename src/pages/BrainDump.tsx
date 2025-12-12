import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, Pin, PinOff, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Note {
  id: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  ai_insights: string | null;
  created_at: string;
  updated_at: string;
}

export default function BrainDump() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadNotes();
  }, [user]);

  const loadNotes = async () => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar notas', variant: 'destructive' });
    } else {
      setNotes((data || []) as Note[]);
    }
    setLoading(false);
  };

  const generateInsights = async (noteId: string, content: string) => {
    if (content.trim().length < 10) return;
    
    setGeneratingInsights(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_context, full_name')
        .eq('id', user?.id)
        .single();

      const response = await supabase.functions.invoke('analyze-content', {
        body: {
          content,
          type: 'note',
          userContext: profile?.user_context,
          userName: profile?.full_name,
        }
      });

      if (response.data?.insights) {
        await supabase
          .from('notes')
          .update({ ai_insights: response.data.insights })
          .eq('id', noteId);
        
        loadNotes();
        toast({ title: '✨ Insights gerados!', description: 'Axiom analisou sua nota' });
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const createNote = async () => {
    if (!newNote.content.trim()) return;

    const { data, error } = await supabase.from('notes').insert({
      user_id: user?.id,
      title: newNote.title || null,
      content: newNote.content,
    }).select().single();

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar nota', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Nota criada!' });
      setNewNote({ title: '', content: '' });
      setDialogOpen(false);
      loadNotes();
      
      if (data) {
        generateInsights(data.id, newNote.content);
      }
    }
  };

  const updateNote = async (note: Note) => {
    const { error } = await supabase
      .from('notes')
      .update({ title: note.title, content: note.content })
      .eq('id', note.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar', variant: 'destructive' });
    } else {
      loadNotes();
    }
  };

  const regenerateInsights = async () => {
    if (selectedNote) {
      generateInsights(selectedNote.id, selectedNote.content);
    }
  };

  const togglePin = async (note: Note) => {
    await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id);
    loadNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    setSelectedNote(null);
    loadNotes();
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.content.toLowerCase().includes(search.toLowerCase()) ||
      n.title?.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned);
  const otherNotes = filteredNotes.filter((n) => !n.is_pinned);

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Brain Dump</h1>
            <p className="text-muted-foreground">Capture suas ideias rapidamente</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Nota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Nota</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título (opcional)</Label>
                  <Input
                    value={newNote.title}
                    onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                    placeholder="Título da nota"
                  />
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea
                    value={newNote.content}
                    onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                    placeholder="Escreva sua ideia..."
                    className="min-h-[150px]"
                  />
                </div>
                <Button onClick={createNote} className="w-full">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
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
              {pinnedNotes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Fixadas
                  </h3>
                  <div className="space-y-2">
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onSelect={() => setSelectedNote(note)}
                        onTogglePin={() => togglePin(note)}
                        onDelete={() => deleteNote(note.id)}
                        isSelected={selectedNote?.id === note.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                {pinnedNotes.length > 0 && (
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Outras notas</h3>
                )}
                {otherNotes.length === 0 && pinnedNotes.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    Nenhuma nota encontrada
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {otherNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onSelect={() => setSelectedNote(note)}
                        onTogglePin={() => togglePin(note)}
                        onDelete={() => deleteNote(note.id)}
                        isSelected={selectedNote?.id === note.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:sticky lg:top-6 h-fit space-y-4">
              {selectedNote ? (
                <>
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <Input
                        value={selectedNote.title || ''}
                        onChange={(e) =>
                          setSelectedNote({ ...selectedNote, title: e.target.value })
                        }
                        onBlur={() => updateNote(selectedNote)}
                        placeholder="Título"
                        className="text-lg font-semibold border-none p-0 focus-visible:ring-0"
                      />
                      <Textarea
                        value={selectedNote.content}
                        onChange={(e) =>
                          setSelectedNote({ ...selectedNote, content: e.target.value })
                        }
                        onBlur={() => updateNote(selectedNote)}
                        className="min-h-[300px] resize-none border-none p-0 focus-visible:ring-0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Última atualização:{' '}
                        {format(new Date(selectedNote.updated_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Insights da IA */}
                  {generatingInsights ? (
                    <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Axiom analisando...</span>
                        </div>
                      </CardContent>
                    </Card>
                  ) : selectedNote.ai_insights ? (
                    <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">Insights do Axiom</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={regenerateInsights}
                            className="text-xs"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Regenerar
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {selectedNote.ai_insights}
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed border-primary/30">
                      <CardContent className="p-4 text-center">
                        <Button
                          variant="ghost"
                          onClick={regenerateInsights}
                          className="text-muted-foreground"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Gerar insights com Axiom
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Selecione uma nota para editar
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function NoteCard({
  note,
  onSelect,
  onTogglePin,
  onDelete,
  isSelected,
}: {
  note: Note;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
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
              {note.title && <p className="font-medium truncate">{note.title}</p>}
              {note.ai_insights && (
                <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(note.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              {note.is_pinned ? (
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
