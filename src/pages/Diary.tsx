import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JournalEntry {
  id: string;
  content: string;
  mood: 'happy' | 'neutral' | 'sad' | 'excited' | 'anxious' | 'calm' | null;
  tags: string[] | null;
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

export default function Diary() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalEntry['mood']>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  useEffect(() => {
    const entry = entries.find((e) =>
      isSameDay(new Date(e.entry_date), selectedDate)
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

  const saveEntry = async () => {
    if (!content.trim()) return;
    setSaving(true);

    const entryDate = format(selectedDate, 'yyyy-MM-dd');

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
      }
    } else {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: user?.id,
        content,
        mood,
        entry_date: entryDate,
      });

      if (error) {
        toast({ title: 'Erro', description: 'Erro ao salvar', variant: 'destructive' });
      } else {
        toast({ title: 'Salvo', description: 'Nova entrada criada!' });
        loadEntries();
      }
    }

    setSaving(false);
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
    return entries.some((e) => isSameDay(new Date(e.entry_date), date));
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
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

            <Card className="lg:col-span-2">
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
                  className="min-h-[300px] resize-none"
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
