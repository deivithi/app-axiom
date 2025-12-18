import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useAxiomSync } from '@/contexts/AxiomSyncContext';
import { Plus, Loader2, Flame, Check, Trash2, Pencil, Target, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly';
  current_streak: number;
  best_streak: number;
  color: string;
}

interface HabitLog {
  id: string;
  habit_id: string;
  completed_at: string;
}

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newHabit, setNewHabit] = useState<{ title: string; frequency: Habit['frequency']; color: string }>({ title: '', frequency: 'daily', color: '#8B5CF6' });
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyAction } = useAxiomSync();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadHabits();
      loadLogs();
    }
  }, [user, currentMonth]);

  // Realtime sync for habits
  const handleHabitInsert = useCallback((newHabit: Habit) => {
    setHabits(prev => {
      if (prev.some(h => h.id === newHabit.id)) return prev;
      return [...prev, newHabit];
    });
  }, []);

  const handleHabitUpdate = useCallback((updatedHabit: Habit) => {
    setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
  }, []);

  const handleHabitDelete = useCallback(({ old }: { old: Habit }) => {
    setHabits(prev => prev.filter(h => h.id !== old.id));
  }, []);

  useRealtimeSync<Habit>('habits', user?.id, {
    onInsert: handleHabitInsert,
    onUpdate: handleHabitUpdate,
    onDelete: handleHabitDelete,
  });

  // Realtime sync for habit logs
  const handleLogInsert = useCallback((newLog: HabitLog) => {
    setLogs(prev => {
      if (prev.some(l => l.id === newLog.id)) return prev;
      return [...prev, newLog];
    });
  }, []);

  const handleLogDelete = useCallback(({ old }: { old: HabitLog }) => {
    setLogs(prev => prev.filter(l => l.id !== old.id));
  }, []);

  useRealtimeSync<HabitLog>('habit_logs', user?.id, {
    onInsert: handleLogInsert,
    onDelete: handleLogDelete,
  });

  const loadHabits = async () => {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar hábitos', variant: 'destructive' });
    } else {
      setHabits((data || []) as Habit[]);
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data } = await supabase
      .from('habit_logs')
      .select('*')
      .gte('completed_at', format(start, 'yyyy-MM-dd'))
      .lte('completed_at', format(end, 'yyyy-MM-dd'));

    setLogs(data || []);
  };

  const createHabit = async () => {
    if (!newHabit.title.trim()) return;

    const { error } = await supabase.from('habits').insert({
      user_id: user?.id,
      title: newHabit.title,
      frequency: newHabit.frequency,
      color: newHabit.color,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar hábito', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Hábito criado!' });
      setNewHabit({ title: '', frequency: 'daily', color: '#8B5CF6' });
      setDialogOpen(false);
      loadHabits();
    }
  };

  const updateHabit = async () => {
    if (!editingHabit) return;

    const { error } = await supabase
      .from('habits')
      .update({
        title: editingHabit.title,
        frequency: editingHabit.frequency,
        color: editingHabit.color,
      })
      .eq('id', editingHabit.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar hábito', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Hábito atualizado!' });
      setEditDialogOpen(false);
      setEditingHabit(null);
      loadHabits();
    }
  };

  const toggleHabitDay = async (habitId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingLog = logs.find(
      (l) => l.habit_id === habitId && l.completed_at === dateStr
    );

    if (existingLog) {
      await supabase.from('habit_logs').delete().eq('id', existingLog.id);
    } else {
      await supabase.from('habit_logs').insert({
        habit_id: habitId,
        user_id: user?.id,
        completed_at: dateStr,
      });
    }
    loadLogs();
  };

  const deleteHabit = async (habitId: string) => {
    await supabase.from('habits').delete().eq('id', habitId);
    loadHabits();
  };

  const openEditDialog = (habit: Habit) => {
    setEditingHabit({ ...habit });
    setEditDialogOpen(true);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const isCompleted = (habitId: string, date: Date) => {
    return logs.some(
      (l) => l.habit_id === habitId && l.completed_at === format(date, 'yyyy-MM-dd')
    );
  };

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="dashboard-header-apple" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <h1>
              <Target />
              Arquiteto de Rotina
            </h1>
            <p>{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-apple">
                <Plus className="h-4 w-4 mr-2" />
                Novo Hábito
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Hábito</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do hábito</Label>
                  <Input
                    value={newHabit.title}
                    onChange={(e) => setNewHabit({ ...newHabit, title: e.target.value })}
                    placeholder="Ex: Meditar 10 minutos"
                  />
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={newHabit.frequency}
                    onValueChange={(v) => setNewHabit({ ...newHabit, frequency: v as Habit['frequency'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={newHabit.color}
                    onChange={(e) => setNewHabit({ ...newHabit, color: e.target.value })}
                    className="h-10 cursor-pointer"
                  />
                </div>
                <Button onClick={createHabit} className="w-full">
                  Criar Hábito
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Hábito</DialogTitle>
            </DialogHeader>
            {editingHabit && (
              <div className="space-y-4">
                <div>
                  <Label>Nome do hábito</Label>
                  <Input
                    value={editingHabit.title}
                    onChange={(e) => setEditingHabit({ ...editingHabit, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Select
                    value={editingHabit.frequency}
                    onValueChange={(v) => setEditingHabit({ ...editingHabit, frequency: v as Habit['frequency'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={editingHabit.color}
                    onChange={(e) => setEditingHabit({ ...editingHabit, color: e.target.value })}
                    className="h-10 cursor-pointer"
                  />
                </div>
                <Button onClick={updateHabit} className="w-full">
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
        ) : habits.length === 0 ? (
          <EmptyState
            icon={<Target className="h-8 w-8" />}
            title="Nenhum hábito cadastrado"
            description="Comece a construir sua rotina criando seu primeiro hábito ou peça ao Axiom para te ajudar."
            action={{
              label: 'Criar Hábito',
              onClick: () => setDialogOpen(true),
            }}
            secondaryAction={{
              label: 'Pedir ao Axiom',
              onClick: () => navigate('/'),
            }}
          />
        ) : (
          <div className="space-y-6">
            {habits.map((habit) => (
              <div key={habit.id} className="habit-card-apple">
                <div className="habit-header">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: habit.color }}
                    />
                    <span className="font-sf-display text-lg font-semibold">{habit.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="streak-badge">
                      <Flame className="h-4 w-4" />
                      <span>{habit.current_streak}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(habit)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteHabit(habit.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="habit-calendar">
                  <div className="grid grid-cols-7 gap-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                      <div key={i} className="text-center text-xs text-muted-foreground py-1 font-medium">
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: days[0].getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {days.map((day) => {
                      const completed = isCompleted(habit.id, day);
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => toggleHabitDay(habit.id, day)}
                          className={cn(
                            'day-cell-apple',
                            isToday(day) && 'today',
                            completed && 'completed'
                          )}
                          style={completed ? { backgroundColor: habit.color } : undefined}
                        >
                          {completed ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            day.getDate()
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
