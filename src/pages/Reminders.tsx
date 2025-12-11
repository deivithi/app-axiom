import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, Bell, Check, Clock, Pencil, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  is_recurring: boolean;
  recurrence_type: 'daily' | 'weekly' | 'monthly' | null;
  category: 'personal' | 'work' | 'health' | 'other';
  is_completed: boolean;
}

const categoryColors = {
  personal: 'bg-primary/20 text-primary',
  work: 'bg-amber-500/20 text-amber-500',
  health: 'bg-emerald-500/20 text-emerald-500',
  other: 'bg-muted text-muted-foreground',
};

const categoryLabels = {
  personal: 'Pessoal',
  work: 'Trabalho',
  health: 'Saúde',
  other: 'Outro',
};

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [newReminder, setNewReminder] = useState({
    title: '',
    description: '',
    remind_at: '',
    is_recurring: false,
    recurrence_type: null as Reminder['recurrence_type'],
    category: 'personal' as Reminder['category'],
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadReminders();
  }, [user]);

  const loadReminders = async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('remind_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar lembretes', variant: 'destructive' });
    } else {
      setReminders((data || []) as Reminder[]);
    }
    setLoading(false);
  };

  const createReminder = async () => {
    if (!newReminder.title.trim() || !newReminder.remind_at) return;

    const { error } = await supabase.from('reminders').insert({
      user_id: user?.id,
      title: newReminder.title,
      description: newReminder.description || null,
      remind_at: newReminder.remind_at,
      is_recurring: newReminder.is_recurring,
      recurrence_type: newReminder.is_recurring ? newReminder.recurrence_type : null,
      category: newReminder.category,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar lembrete', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lembrete criado!' });
      setNewReminder({
        title: '',
        description: '',
        remind_at: '',
        is_recurring: false,
        recurrence_type: null,
        category: 'personal',
      });
      setDialogOpen(false);
      loadReminders();
    }
  };

  const updateReminder = async () => {
    if (!editingReminder) return;

    const { error } = await supabase
      .from('reminders')
      .update({
        title: editingReminder.title,
        description: editingReminder.description,
        remind_at: editingReminder.remind_at,
        is_recurring: editingReminder.is_recurring,
        recurrence_type: editingReminder.is_recurring ? editingReminder.recurrence_type : null,
        category: editingReminder.category,
      })
      .eq('id', editingReminder.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar lembrete', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Lembrete atualizado!' });
      setEditDialogOpen(false);
      setEditingReminder(null);
      loadReminders();
    }
  };

  const toggleCompleted = async (id: string, completed: boolean) => {
    await supabase.from('reminders').update({ is_completed: completed }).eq('id', id);
    toast({ title: completed ? 'Concluído!' : 'Voltou para pendente' });
    loadReminders();
  };

  const deleteReminder = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id);
    loadReminders();
  };

  const openEditDialog = (reminder: Reminder) => {
    setEditingReminder({ ...reminder });
    setEditDialogOpen(true);
  };

  const pendingReminders = reminders.filter((r) => !r.is_completed);
  const completedReminders = reminders.filter((r) => r.is_completed);

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Lembretes</h1>
            <p className="text-muted-foreground">Nunca esqueça o que é importante</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Lembrete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Lembrete</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                    placeholder="O que você precisa lembrar?"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newReminder.description}
                    onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                    placeholder="Detalhes opcionais"
                  />
                </div>
                <div>
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={newReminder.remind_at}
                    onChange={(e) => setNewReminder({ ...newReminder, remind_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={newReminder.category}
                    onValueChange={(v: Reminder['category']) => setNewReminder({ ...newReminder, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Pessoal</SelectItem>
                      <SelectItem value="work">Trabalho</SelectItem>
                      <SelectItem value="health">Saúde</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Lembrete recorrente</Label>
                  <Switch
                    checked={newReminder.is_recurring}
                    onCheckedChange={(checked) =>
                      setNewReminder({ ...newReminder, is_recurring: checked })
                    }
                  />
                </div>
                {newReminder.is_recurring && (
                  <div>
                    <Label>Repetir</Label>
                    <Select
                      value={newReminder.recurrence_type || 'daily'}
                      onValueChange={(v: 'daily' | 'weekly' | 'monthly') =>
                        setNewReminder({ ...newReminder, recurrence_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={createReminder} className="w-full">
                  Criar Lembrete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Lembrete</DialogTitle>
            </DialogHeader>
            {editingReminder && (
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={editingReminder.title}
                    onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={editingReminder.description || ''}
                    onChange={(e) => setEditingReminder({ ...editingReminder, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data e hora</Label>
                  <Input
                    type="datetime-local"
                    value={editingReminder.remind_at ? editingReminder.remind_at.slice(0, 16) : ''}
                    onChange={(e) => setEditingReminder({ ...editingReminder, remind_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select
                    value={editingReminder.category}
                    onValueChange={(v: Reminder['category']) => setEditingReminder({ ...editingReminder, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Pessoal</SelectItem>
                      <SelectItem value="work">Trabalho</SelectItem>
                      <SelectItem value="health">Saúde</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Lembrete recorrente</Label>
                  <Switch
                    checked={editingReminder.is_recurring}
                    onCheckedChange={(checked) =>
                      setEditingReminder({ ...editingReminder, is_recurring: checked })
                    }
                  />
                </div>
                {editingReminder.is_recurring && (
                  <div>
                    <Label>Repetir</Label>
                    <Select
                      value={editingReminder.recurrence_type || 'daily'}
                      onValueChange={(v: 'daily' | 'weekly' | 'monthly') =>
                        setEditingReminder({ ...editingReminder, recurrence_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diariamente</SelectItem>
                        <SelectItem value="weekly">Semanalmente</SelectItem>
                        <SelectItem value="monthly">Mensalmente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={updateReminder} className="w-full">
                  Salvar Alterações
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Pendentes ({pendingReminders.length})
              </h2>
              {pendingReminders.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground">
                  Nenhum lembrete pendente
                </Card>
              ) : (
                <div className="space-y-2">
                  {pendingReminders.map((reminder) => {
                    const remindDate = new Date(reminder.remind_at);
                    const isOverdue = isPast(remindDate) && !isToday(remindDate);

                    return (
                      <Card key={reminder.id} className={cn(isOverdue && 'border-destructive')}>
                        <CardContent className="p-4 flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6 rounded-full shrink-0"
                              onClick={() => toggleCompleted(reminder.id, true)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <div>
                              <p className="font-medium">{reminder.title}</p>
                              {reminder.description && (
                                <p className="text-sm text-muted-foreground">{reminder.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={categoryColors[reminder.category]}>
                                  {categoryLabels[reminder.category]}
                                </Badge>
                                <span className={cn('text-xs flex items-center gap-1', isOverdue && 'text-destructive')}>
                                  <Clock className="h-3 w-3" />
                                  {format(remindDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(reminder)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteReminder(reminder.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {completedReminders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                  Concluídos ({completedReminders.length})
                </h2>
                <div className="space-y-2 opacity-60">
                  {completedReminders.map((reminder) => (
                    <Card key={reminder.id}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <Check className="h-3 w-3 text-emerald-500" />
                          </div>
                          <span className="line-through">{reminder.title}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCompleted(reminder.id, false)}
                            title="Voltar para pendente"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(reminder)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => deleteReminder(reminder.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
