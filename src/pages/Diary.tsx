import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useAxiomSync } from '@/contexts/AxiomSyncContext';
import { Loader2, Save, Trash2, Sparkles } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JournalEntry {
  id: string;
  content: string;
  mood: 'happy' | 'neutral' | 'sad' | 'excited' | 'anxious' | 'calm' | null;
  tags: string[] | null;
  ai_insights: string | null;
  entry_date: string;
}

const moodEmojis = {
  happy: '😊',
  neutral: '😐',
  sad: '😢',
  excited: '🤩',
  anxious: '😰',
  calm: '😌',
};

const moodLabels = {
  happy: 'Feliz',
  neutral: 'Neutro',
  sad: 'Triste',
  excited: 'Empolgado',
  anxious: 'Ansioso',
  calm: 'Calmo',
};

// Converte string YYYY-MM-DD para Date no timezone LOCAL (não UTC)
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function Diary() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyAction } = useAxiomSync();

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  // Realtime sync for journal entries
  const handleInsert = useCallback((newEntry: JournalEntry) => {
    setEntries(prev => {
      if (prev.some(e => e.id === newEntry.id)) return prev;
      return [newEntry, ...prev].sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
    });
  }, []);

  const handleUpdate = useCallback((updatedEntry: JournalEntry) => {
    setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
  }, []);

  const handleDelete = useCallback(({ old }: { old: JournalEntry }) => {
    setEntries(prev => prev.filter(e => e.id !== old.id));
  }, []);

  useRealtimeSync<JournalEntry>('journal_entries', user?.id, {
    onInsert: handleInsert,
    onUpdate: handleUpdate,
    onDelete: handleDelete,
  });

  useEffect(() => {
    const entry = entries.find((e) =>
      isSameDay(parseLocalDate(e.entry_date), selectedDate)
    );
    setCurrentEntry(entry || null);
    setContent(entry?.content || '');
    setMood(entry?.mood || null);
  }, [selectedDate, entries]);

  const loadEntries = async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .order('entry_date', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar entradas', variant: 'destructive' });
    } else {
      setEntries((data || []) as JournalEntry[]);
    }
    setLoading(false);
  };

  const generateInsights = async (entryId: string, entryContent: string, entryMood: string | null) => {
    if (entryContent.trim().length < 10) return;
    
    setGeneratingInsights(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_context, full_name')
        .eq('id', user?.id)
        .single();

      const response = await supabase.functions.invoke('analyze-content', {
        body: {
          content: entryContent,
          type: 'journal',
          mood: entryMood,
          userContext: profile?.user_context,
          userName: profile?.full_name,
        }
      });

      if (response.data?.insights) {
        await supabase
          .from('journal_entries')
          .update({ ai_insights: response.data.insights })
          .eq('id', entryId);
        
        loadEntries();
        toast({ title: '✨ Insights gerados!', description: 'Axiom analisou sua entrada' });
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const saveEntry = async () => {
    if (!content.trim()) return;
    setSaving(true);

    // Use local date without UTC conversion to avoid timezone issues
    const entryDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    if (currentEntry) {
      const { error } = await supabase
        .from('journal_entries')
        .update({ content, mood })
        .eq('id', currentEntry.id);

      if (error) {
        toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' });
      } else {
        toast({ title: 'Salvo', description: 'Entrada atualizada!' });
        loadEntries();
        generateInsights(currentEntry.id, content, mood);
      }
    } else {
      const { data, error } = await supabase.from('journal_entries').insert({
        user_id: user?.id,
        content,
        mood,
        entry_date: entryDate,
      }).select().single();

      if (error) {
        toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' });
      } else {
        toast({ title: 'Salvo', description: 'Nova entrada criada!' });
        loadEntries();
        if (data) {
          generateInsights(data.id, content, mood);
        }
      }
    }

    setSaving(false);
  };

  const regenerateInsights = async () => {
    if (currentEntry) {
      generateInsights(currentEntry.id, currentEntry.content, currentEntry.mood);
    }
  };

  const deleteEntry = async () => {
    if (!currentEntry) return;

    await supabase.from('journal_entries').delete().eq('id', currentEntry.id);
    setContent('');
    setMood(null);
    loadEntries();
    toast({ title: 'Deletado', description: 'Entrada removida' });
  };

  const hasEntry = (date: Date) => {
    return entries.some((e) => isSameDay(parseLocalDate(e.entry_date), date));
  };

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Diário</h1>
          <p className="text-muted-foreground">Registre seus pensamentos e sentimentos</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ptBR}
                  modifiers={{
                    hasEntry: (date) => hasEntry(date),
                  }}
                  modifiersStyles={{
                    hasEntry: {
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      textDecorationColor: 'hsl(var(--primary))',
                    },
                  }}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                    </CardTitle>
                    {currentEntry && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={deleteEntry}
                      >
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
                        <Button
                          key={m}
                          variant={mood === m ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMood(m)}
                          className="gap-1"
                        >
                          <span>{moodEmojis[m]}</span>
                          <span className="hidden sm:inline">{moodLabels[m]}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Escreva sobre o seu dia..."
                    className="min-h-[200px] resize-none"
                  />

                  <Button onClick={saveEntry} disabled={saving || !content.trim()} className="w-full">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Salvar
                  </Button>
                </CardContent>
              </Card>

              {/* Insights da IA */}
              {generatingInsights ? (
                <Card className="bg-gradient-to-br from-primary/10 to-cyan-500/10 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Axiom analisando sua entrada...</span>
                    </div>
                  </CardContent>
                </Card>
              ) : currentEntry?.ai_insights ? (
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
                      {currentEntry.ai_insights}
                    </p>
                  </CardContent>
                </Card>
              ) : currentEntry ? (
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
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
