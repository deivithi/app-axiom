import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Plus, Loader2, Trash2, Pin, PinOff, Search, Sparkles, Brain, BookOpen, Save, MessageSquare, Lightbulb, Cpu } from 'lucide-react';
import MemoryDashboard from '@/components/memory/MemoryDashboard';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PageErrorBoundary from '@/components/PageErrorBoundary';

interface Note {
  id: string;
  title: string | null;
  content: string;
  is_pinned: boolean;
  ai_insights: string | null;
  created_at: string;
  updated_at: string;
}

interface JournalEntry {
  id: string;
  content: string;
  mood: 'happy' | 'neutral' | 'sad' | 'excited' | 'anxious' | 'calm' | null;
  ai_insights: string | null;
  entry_date: string;
}

const moodEmojis = {
  happy: '😊', neutral: '😐', sad: '😢', excited: '🤩', anxious: '😰', calm: '😌',
};

const moodLabels = {
  happy: 'Feliz', neutral: 'Neutro', sad: 'Triste', excited: 'Empolgado', anxious: 'Ansioso', calm: 'Calmo',
};

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

function MemoryContent() {
  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '' });

  // Journal state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadNotes();
      loadEntries();
    }
  }, [user]);

  useEffect(() => {
    const entry = entries.find(e => isSameDay(parseLocalDate(e.entry_date), selectedDate));
    setCurrentEntry(entry || null);
    setJournalContent(entry?.content || '');
    setMood(entry?.mood || null);
  }, [selectedDate, entries]);

  // Realtime sync
  useRealtimeSync<Note>('notes', user?.id, {
    onInsert: useCallback((newNote: Note) => {
      setNotes(prev => prev.some(n => n.id === newNote.id) ? prev : [newNote, ...prev]);
    }, []),
    onUpdate: useCallback((updatedNote: Note) => {
      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
    }, []),
    onDelete: useCallback(({ old }: { old: Note }) => {
      setNotes(prev => prev.filter(n => n.id !== old.id));
    }, []),
  });

  useRealtimeSync<JournalEntry>('journal_entries', user?.id, {
    onInsert: useCallback((newEntry: JournalEntry) => {
      setEntries(prev => prev.some(e => e.id === newEntry.id) ? prev : [newEntry, ...prev]);
    }, []),
    onUpdate: useCallback((updatedEntry: JournalEntry) => {
      setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    }, []),
    onDelete: useCallback(({ old }: { old: JournalEntry }) => {
      setEntries(prev => prev.filter(e => e.id !== old.id));
    }, []),
  });

  const loadNotes = async () => {
    try {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      setNotes((data || []) as Note[]);
    } catch (error) {
      console.error('[Memory] Erro em loadNotes:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar notas', variant: 'destructive' });
    }
    setLoading(false);
  };

  const loadEntries = async () => {
    try {
      const { data } = await supabase.from('journal_entries').select('*').order('entry_date', { ascending: false });
      setEntries((data || []) as JournalEntry[]);
    } catch (error) {
      console.error('[Memory] Erro em loadEntries:', error);
    }
  };

  const generateInsights = async (type: 'note' | 'journal', id: string, content: string, entryMood?: string | null) => {
    if (content.trim().length < 10) return;
    setGeneratingInsights(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('user_context, full_name').eq('id', user?.id).single();
      const response = await supabase.functions.invoke('analyze-content', {
        body: { content, type, mood: entryMood, userContext: profile?.user_context, userName: profile?.full_name }
      });
      if (response.data?.insights) {
        const table = type === 'note' ? 'notes' : 'journal_entries';
        await supabase.from(table).update({ ai_insights: response.data.insights }).eq('id', id);
        type === 'note' ? loadNotes() : loadEntries();
        toast({ title: '✨ Insights gerados!', description: 'Axiom analisou seu conteúdo' });
      }
    } catch (error) {
      console.error('[Memory] Erro em generateInsights:', error);
      toast({ title: 'Erro', description: 'Erro ao gerar insights', variant: 'destructive' });
    }
    setGeneratingInsights(false);
  };

  // Note operations
  const createNote = async () => {
    if (!newNote.content.trim()) return;
    try {
      const { data } = await supabase.from('notes').insert({
        user_id: user?.id,
        title: newNote.title || null,
        content: newNote.content,
      }).select().single();
      toast({ title: 'Sucesso', description: 'Nota criada!' });
      setNewNote({ title: '', content: '' });
      setNoteDialogOpen(false);
      loadNotes();
      if (data) generateInsights('note', data.id, newNote.content);
    } catch (error) {
      console.error('[Memory] Erro em createNote:', error);
      toast({ title: 'Erro', description: 'Erro ao criar nota', variant: 'destructive' });
    }
  };

  const updateNote = async (note: Note) => {
    try {
      await supabase.from('notes').update({ title: note.title, content: note.content }).eq('id', note.id);
      loadNotes();
    } catch (error) {
      console.error('[Memory] Erro em updateNote:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar nota', variant: 'destructive' });
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id);
      loadNotes();
    } catch (error) {
      console.error('[Memory] Erro em togglePin:', error);
      toast({ title: 'Erro', description: 'Erro ao fixar nota', variant: 'destructive' });
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await supabase.from('notes').delete().eq('id', id);
      setSelectedNote(null);
      loadNotes();
    } catch (error) {
      console.error('[Memory] Erro em deleteNote:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir nota', variant: 'destructive' });
    }
  };

  // Journal operations
  const saveJournalEntry = async () => {
    if (!journalContent.trim()) return;
    setSaving(true);
    try {
      const entryDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

      if (currentEntry) {
        await supabase.from('journal_entries').update({ content: journalContent, mood }).eq('id', currentEntry.id);
        toast({ title: 'Salvo', description: 'Entrada atualizada!' });
        loadEntries();
        generateInsights('journal', currentEntry.id, journalContent, mood);
      } else {
        const { data } = await supabase.from('journal_entries').insert({
          user_id: user?.id,
          content: journalContent,
          mood,
          entry_date: entryDate,
        }).select().single();
        toast({ title: 'Salvo', description: 'Nova entrada criada!' });
        loadEntries();
        if (data) generateInsights('journal', data.id, journalContent, mood);
      }
    } catch (error) {
      console.error('[Memory] Erro em saveJournalEntry:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar entrada', variant: 'destructive' });
    }
    setSaving(false);
  };

  const deleteJournalEntry = async () => {
    if (!currentEntry) return;
    try {
      await supabase.from('journal_entries').delete().eq('id', currentEntry.id);
      setJournalContent('');
      setMood(null);
      loadEntries();
      toast({ title: 'Deletado', description: 'Entrada removida' });
    } catch (error) {
      console.error('[Memory] Erro em deleteJournalEntry:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir entrada', variant: 'destructive' });
    }
  };

  const hasEntry = (date: Date) => entries.some(e => isSameDay(parseLocalDate(e.entry_date), date));

  const filteredNotes = notes.filter(n =>
    (n.content?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (n.title?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
  const otherNotes = filteredNotes.filter(n => !n.is_pinned);

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-8">
        <div className="dashboard-header-apple">
          <h1>
            <Brain />
            Segunda Memória
          </h1>
          <p>Pensamentos e reflexões unificados para clareza mental</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="axiom-memory" className="space-y-6 tabs-apple">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="axiom-memory" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Cpu className="h-4 w-4" />
                Axiom Memory
              </TabsTrigger>
              <TabsTrigger value="thoughts" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Brain className="h-4 w-4" />
                Pensamentos ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="journal" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <BookOpen className="h-4 w-4" />
                Diário ({entries.length})
              </TabsTrigger>
            </TabsList>

            {/* AXIOM MEMORY DASHBOARD */}
            <TabsContent value="axiom-memory" className="space-y-4">
              <MemoryDashboard />
            </TabsContent>

            {/* PENSAMENTOS */}
            <TabsContent value="thoughts" className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar notas..." className="pl-10" />
                </div>
                <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Nova Nota</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Nota</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Título (opcional)</Label>
                        <Input value={newNote.title} onChange={(e) => setNewNote({ ...newNote, title: e.target.value })} placeholder="Título da nota" />
                      </div>
                      <div>
                        <Label>Conteúdo</Label>
                        <Textarea value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} placeholder="Escreva sua ideia..." className="min-h-[150px]" />
                      </div>
                      <Button onClick={createNote} className="w-full">Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {pinnedNotes.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1"><Pin className="h-3 w-3" /> Fixadas</h3>
                      <div className="space-y-2">
                        {pinnedNotes.map((note) => (
                          <NoteCard key={note.id} note={note} onSelect={() => setSelectedNote(note)} onTogglePin={() => togglePin(note)} onDelete={() => deleteNote(note.id)} isSelected={selectedNote?.id === note.id} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    {pinnedNotes.length > 0 && <h3 className="text-sm font-medium text-muted-foreground mb-2">Outras notas</h3>}
                  {otherNotes.length === 0 && pinnedNotes.length === 0 ? (
                      <EmptyState
                        icon={<Lightbulb className="h-8 w-8" />}
                        title="Nenhum pensamento registrado"
                        description="Capture suas ideias criando uma nota ou converse com Axiom para organizar seus pensamentos."
                        action={{
                          label: 'Nova Nota',
                          onClick: () => setNoteDialogOpen(true),
                        }}
                        secondaryAction={{
                          label: 'Conversar com Axiom',
                          onClick: () => navigate('/'),
                        }}
                      />
                    ) : (
                      <div className="space-y-2">
                        {otherNotes.map((note) => (
                          <NoteCard key={note.id} note={note} onSelect={() => setSelectedNote(note)} onTogglePin={() => togglePin(note)} onDelete={() => deleteNote(note.id)} isSelected={selectedNote?.id === note.id} />
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
                          <Input value={selectedNote.title || ''} onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })} onBlur={() => updateNote(selectedNote)} placeholder="Título" className="text-lg font-semibold border-none p-0 focus-visible:ring-0" />
                          <Textarea value={selectedNote.content} onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })} onBlur={() => updateNote(selectedNote)} className="min-h-[300px] resize-none border-none p-0 focus-visible:ring-0" />
                          <p className="text-xs text-muted-foreground">Última atualização: {selectedNote.updated_at ? format(new Date(selectedNote.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '--'}</p>
                        </CardContent>
                      </Card>
                      <InsightCard insight={selectedNote.ai_insights} generating={generatingInsights} onRegenerate={() => generateInsights('note', selectedNote.id, selectedNote.content)} />
                    </>
                  ) : (
                    <Card className="p-8 text-center text-muted-foreground">Selecione uma nota para editar</Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* DIÁRIO */}
            <TabsContent value="journal" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                  <CardContent className="p-4">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      locale={ptBR}
                      modifiers={{ hasEntry }}
                      modifiersStyles={{ hasEntry: { fontWeight: 'bold', textDecoration: 'underline', textDecorationColor: 'hsl(var(--primary))' } }}
                      className="rounded-md"
                    />
                  </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle>{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</CardTitle>
                        {currentEntry && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={deleteJournalEntry}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Como você está se sentindo?</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(moodEmojis) as Array<keyof typeof moodEmojis>).map((m) => (
                            <Button key={m} variant={mood === m ? 'default' : 'outline'} size="sm" onClick={() => setMood(m)} className="gap-1">
                              <span>{moodEmojis[m]}</span>
                              <span className="hidden sm:inline">{moodLabels[m]}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Textarea value={journalContent} onChange={(e) => setJournalContent(e.target.value)} placeholder="Escreva sobre o seu dia..." className="min-h-[200px] resize-none" />
                      <Button onClick={saveJournalEntry} disabled={saving || !journalContent.trim()} className="w-full">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Salvar
                      </Button>
                    </CardContent>
                  </Card>

                  {currentEntry && (
                    <InsightCard insight={currentEntry.ai_insights} generating={generatingInsights} onRegenerate={() => generateInsights('journal', currentEntry.id, currentEntry.content, currentEntry.mood)} />
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

function NoteCard({ note, onSelect, onTogglePin, onDelete, isSelected }: { note: Note; onSelect: () => void; onTogglePin: () => void; onDelete: () => void; isSelected: boolean; }) {
  return (
    <Card className={cn('cursor-pointer transition-colors', isSelected && 'ring-2 ring-primary')} onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {note.title && <p className="font-medium truncate">{note.title}</p>}
              {note.ai_insights && <Sparkles className="h-3 w-3 text-primary flex-shrink-0" />}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-2">{note.created_at ? format(new Date(note.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '--'}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
              {note.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight, generating, onRegenerate }: { insight: string | null; generating: boolean; onRegenerate: () => void; }) {
  if (generating) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Axiom analisando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insight) {
    return (
      <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Insights do Axiom</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Regenerar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{insight}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-primary/30">
      <CardContent className="p-4 text-center">
        <Button variant="ghost" onClick={onRegenerate} className="text-muted-foreground">
          <Sparkles className="h-4 w-4 mr-2" />
          Gerar insights com Axiom
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Memory() {
  return (
    <PageErrorBoundary pageName="Memória">
      <MemoryContent />
    </PageErrorBoundary>
  );
}
