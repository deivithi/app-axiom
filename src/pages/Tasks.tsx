import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
}

const columns = [
  { id: 'todo', title: 'A Fazer', color: 'bg-muted' },
  { id: 'doing', title: 'Fazendo', color: 'bg-primary/20' },
  { id: 'done', title: 'Concluído', color: 'bg-emerald-500/20' },
] as const;

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-amber-500/20 text-amber-500',
  high: 'bg-destructive/20 text-destructive',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) loadTasks();
  }, [user]);

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar tarefas', variant: 'destructive' });
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;

    const { error } = await supabase.from('tasks').insert({
      user_id: user?.id,
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      status: 'todo',
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar tarefa', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Tarefa criada!' });
      setNewTask({ title: '', description: '', priority: 'medium' });
      setDialogOpen(false);
      loadTasks();
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar tarefa', variant: 'destructive' });
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao deletar tarefa', variant: 'destructive' });
    } else {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    updateTaskStatus(taskId, status);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tarefas</h1>
            <p className="text-muted-foreground">Organize suas atividades</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Tarefa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Digite o título"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(v) => setNewTask({ ...newTask, priority: v as Task['priority'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createTask} className="w-full">
                  Criar Tarefa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((col) => (
              <Card
                key={col.id}
                className={cn('min-h-[400px]', col.color)}
                onDrop={(e) => handleDrop(e, col.id)}
                onDragOver={handleDragOver}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {col.title}
                    <Badge variant="secondary">
                      {tasks.filter((t) => t.status === col.id).length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks
                    .filter((t) => t.status === col.id)
                    .map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="bg-background p-3 rounded-lg border cursor-move group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-1 opacity-50" />
                            <div className="flex-1">
                              <p className="font-medium">{task.title}</p>
                              {task.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <Badge className={cn('mt-2 text-xs', priorityColors[task.priority])}>
                                {task.priority === 'low' ? 'Baixa' : task.priority === 'medium' ? 'Média' : 'Alta'}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"
                            onClick={() => deleteTask(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
