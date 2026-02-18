import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useAxiomSync } from '@/contexts/AxiomSyncContext';
import { Plus, Loader2, GripVertical, Trash2, Pencil, ChevronDown, ChevronUp, FolderKanban, CheckSquare, Inbox, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { useNavigate } from 'react-router-dom';
import PageErrorBoundary from '@/components/PageErrorBoundary';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed';
  progress: number;
}

interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  completed: boolean;
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

const statusColors = {
  active: 'bg-emerald-500/20 text-emerald-500',
  paused: 'bg-amber-500/20 text-amber-500',
  completed: 'bg-primary/20 text-primary',
};

const statusLabels = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
};

function ExecutionContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Task['priority'] });
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyAction } = useAxiomSync();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadTasks();
      loadProjects();
      loadProjectTasks();
    }
  }, [user]);

  // Realtime sync for tasks
  useRealtimeSync<Task>('tasks', user?.id, {
    onInsert: useCallback((newTask: Task) => {
      setTasks(prev => prev.some(t => t.id === newTask.id) ? prev : [newTask, ...prev]);
    }, []),
    onUpdate: useCallback((updatedTask: Task) => {
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    }, []),
    onDelete: useCallback(({ old }: { old: Task }) => {
      setTasks(prev => prev.filter(t => t.id !== old.id));
    }, []),
  });

  // Realtime sync for projects
  useRealtimeSync<Project>('projects', user?.id, {
    onInsert: useCallback((newProject: Project) => {
      setProjects(prev => prev.some(p => p.id === newProject.id) ? prev : [...prev, newProject]);
    }, []),
    onUpdate: useCallback((updatedProject: Project) => {
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    }, []),
    onDelete: useCallback(({ old }: { old: Project }) => {
      setProjects(prev => prev.filter(p => p.id !== old.id));
    }, []),
  });

  // Realtime sync for project tasks
  useRealtimeSync<ProjectTask>('project_tasks', user?.id, {
    onInsert: useCallback((newTask: ProjectTask) => {
      setProjectTasks(prev => prev.some(t => t.id === newTask.id) ? prev : [...prev, newTask]);
    }, []),
    onUpdate: useCallback((updatedTask: ProjectTask) => {
      setProjectTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    }, []),
    onDelete: useCallback(({ old }: { old: ProjectTask }) => {
      setProjectTasks(prev => prev.filter(t => t.id !== old.id));
    }, []),
  });

  const loadTasks = async () => {
    try {
      const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200);
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('[Execution] Erro em loadTasks:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar tarefas', variant: 'destructive' });
    }
    setLoading(false);
  };

  const loadProjects = async () => {
    try {
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(100);
      setProjects((data || []) as Project[]);
    } catch (error) {
      console.error('[Execution] Erro em loadProjects:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar projetos', variant: 'destructive' });
    }
  };

  const loadProjectTasks = async () => {
    try {
      const { data } = await supabase.from('project_tasks').select('*').limit(500);
      setProjectTasks(data || []);
    } catch (error) {
      console.error('[Execution] Erro em loadProjectTasks:', error);
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    try {
      await supabase.from('tasks').insert({
        user_id: user?.id,
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        status: 'todo',
      });
      toast({ title: 'Sucesso', description: 'Tarefa criada!' });
      setNewTask({ title: '', description: '', priority: 'medium' });
      setTaskDialogOpen(false);
      loadTasks();
    } catch (error) {
      console.error('[Execution] Erro em createTask:', error);
      toast({ title: 'Erro', description: 'Erro ao criar tarefa', variant: 'destructive' });
    }
  };

  const updateTask = async () => {
    if (!editingTask) return;
    try {
      await supabase.from('tasks').update({
        title: editingTask.title,
        description: editingTask.description,
        priority: editingTask.priority,
        status: editingTask.status,
      }).eq('id', editingTask.id);
      toast({ title: 'Sucesso', description: 'Tarefa atualizada!' });
      setEditTaskDialogOpen(false);
      setEditingTask(null);
      loadTasks();
    } catch (error) {
      console.error('[Execution] Erro em updateTask:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar tarefa', variant: 'destructive' });
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      if (newStatus === 'done' && task) {
        notifyAction('complete_task', 'tasks', `✓ Tarefa "${task.title}" concluída!`);
      }
    } catch (error) {
      console.error('[Execution] Erro em updateTaskStatus:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
      console.error('[Execution] Erro em deleteTask:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir tarefa', variant: 'destructive' });
    }
  };

  const createProject = async () => {
    if (!newProject.title.trim()) return;
    try {
      await supabase.from('projects').insert({
        user_id: user?.id,
        title: newProject.title,
        description: newProject.description || null,
      });
      toast({ title: 'Sucesso', description: 'Projeto criado!' });
      setNewProject({ title: '', description: '' });
      setProjectDialogOpen(false);
      loadProjects();
    } catch (error) {
      console.error('[Execution] Erro em createProject:', error);
      toast({ title: 'Erro', description: 'Erro ao criar projeto', variant: 'destructive' });
    }
  };

  const updateProject = async () => {
    if (!editingProject) return;
    try {
      await supabase.from('projects').update({
        title: editingProject.title,
        description: editingProject.description,
      }).eq('id', editingProject.id);
      toast({ title: 'Sucesso', description: 'Projeto atualizado!' });
      setEditProjectDialogOpen(false);
      setEditingProject(null);
      loadProjects();
    } catch (error) {
      console.error('[Execution] Erro em updateProject:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar projeto', variant: 'destructive' });
    }
  };

  const updateProjectStatus = async (projectId: string, status: Project['status']) => {
    try {
      await supabase.from('projects').update({ status }).eq('id', projectId);
      loadProjects();
    } catch (error) {
      console.error('[Execution] Erro em updateProjectStatus:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await supabase.from('projects').delete().eq('id', projectId);
      loadProjects();
    } catch (error) {
      console.error('[Execution] Erro em deleteProject:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir projeto', variant: 'destructive' });
    }
  };

  const addProjectTask = async (projectId: string) => {
    if (!newSubtaskTitle.trim()) return;
    try {
      await supabase.from('project_tasks').insert({
        project_id: projectId,
        user_id: user?.id,
        title: newSubtaskTitle,
      });
      setNewSubtaskTitle('');
      loadProjectTasks();
      updateProjectProgress(projectId);
    } catch (error) {
      console.error('[Execution] Erro em addProjectTask:', error);
      toast({ title: 'Erro', description: 'Erro ao adicionar subtarefa', variant: 'destructive' });
    }
  };

  const toggleProjectTask = async (taskId: string, completed: boolean, projectId: string) => {
    try {
      await supabase.from('project_tasks').update({ completed }).eq('id', taskId);
      loadProjectTasks();
      updateProjectProgress(projectId);
    } catch (error) {
      console.error('[Execution] Erro em toggleProjectTask:', error);
      toast({ title: 'Erro', description: 'Erro ao atualizar subtarefa', variant: 'destructive' });
    }
  };

  const deleteProjectTask = async (taskId: string, projectId: string) => {
    try {
      await supabase.from('project_tasks').delete().eq('id', taskId);
      loadProjectTasks();
      updateProjectProgress(projectId);
    } catch (error) {
      console.error('[Execution] Erro em deleteProjectTask:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir subtarefa', variant: 'destructive' });
    }
  };

  const updateProjectProgress = async (projectId: string) => {
    try {
      const tasks = projectTasks.filter(t => t.project_id === projectId);
      const completed = tasks.filter(t => t.completed).length;
      const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      await supabase.from('projects').update({ progress }).eq('id', projectId);
      loadProjects();
    } catch (error) {
      console.error('[Execution] Erro em updateProjectProgress:', error);
    }
  };

  const getProjectTasks = (projectId: string) => projectTasks.filter(t => t.project_id === projectId);

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
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-8">
        <div className="dashboard-header-apple">
          <h1>
            <CheckSquare />
            Sistema de Execução
          </h1>
          <p>Tarefas e projetos unificados para máxima produtividade</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="tasks" className="space-y-6 tabs-apple">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="tasks" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <CheckSquare className="h-4 w-4" />
                Tarefas ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <FolderKanban className="h-4 w-4" />
                Projetos ({projects.length})
              </TabsTrigger>
            </TabsList>

            {/* TAREFAS */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Nova Tarefa</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Título</Label>
                        <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Digite o título" />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Descrição opcional" maxLength={1000} />
                      </div>
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v as Task['priority'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={createTask} className="w-full">Criar Tarefa</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Task Dialog */}
              <Dialog open={editTaskDialogOpen} onOpenChange={setEditTaskDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
                  {editingTask && (
                    <div className="space-y-4">
                      <div>
                        <Label>Título</Label>
                        <Input value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={editingTask.description || ''} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} maxLength={1000} />
                      </div>
                      <div>
                        <Label>Prioridade</Label>
                        <Select value={editingTask.priority} onValueChange={(v) => setEditingTask({ ...editingTask, priority: v as Task['priority'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="medium">Média</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={editingTask.status} onValueChange={(v) => setEditingTask({ ...editingTask, status: v as Task['status'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">A Fazer</SelectItem>
                            <SelectItem value="doing">Fazendo</SelectItem>
                            <SelectItem value="done">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={updateTask} className="w-full">Salvar Alterações</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* Kanban Board */}
              {tasks.length === 0 ? (
                <EmptyState
                  icon={<Inbox className="h-8 w-8" />}
                  title="Nenhuma tarefa cadastrada"
                  description="Crie tarefas para organizar seu dia ou peça ao Axiom para te ajudar."
                  action={{
                    label: 'Nova Tarefa',
                    onClick: () => setTaskDialogOpen(true),
                  }}
                  secondaryAction={{
                    label: 'Pedir ao Axiom',
                    onClick: () => navigate('/'),
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      className="kanban-column-apple"
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragOver={handleDragOver}
                    >
                      <div className="column-header">
                        <div className="column-title">
                          {col.title}
                          <Badge variant="secondary" className="ml-2">{tasks.filter(t => t.status === col.id).length}</Badge>
                        </div>
                      </div>
                      <div className="column-content space-y-3">
                        {tasks.filter(t => t.status === col.id).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            Arraste tarefas aqui
                          </p>
                        ) : (
                          tasks.filter(t => t.status === col.id).map((task) => (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              className="task-card-apple group"
                            >
                              <div className="flex items-start justify-between">
                                <span className="task-title">{task.title}</span>
                                <span className={cn('priority-badge', task.priority)}>
                                  {task.priority === 'low' ? 'Baixa' : task.priority === 'medium' ? 'Média' : 'Alta'}
                                </span>
                              </div>
                              {task.description && (
                                <p className="task-description line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTask({ ...task }); setEditTaskDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTask(task.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* PROJETOS */}
            <TabsContent value="projects" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" />Novo Projeto</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Nome</Label>
                        <Input value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} placeholder="Nome do projeto" />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Descrição opcional" />
                      </div>
                      <Button onClick={createProject} className="w-full">Criar Projeto</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Edit Project Dialog */}
              <Dialog open={editProjectDialogOpen} onOpenChange={setEditProjectDialogOpen}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Editar Projeto</DialogTitle></DialogHeader>
                  {editingProject && (
                    <div className="space-y-4">
                      <div>
                        <Label>Nome</Label>
                        <Input value={editingProject.title} onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })} />
                      </div>
                      <div>
                        <Label>Descrição</Label>
                        <Textarea value={editingProject.description || ''} onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })} />
                      </div>
                      <Button onClick={updateProject} className="w-full">Salvar Alterações</Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {projects.length === 0 ? (
                <EmptyState
                  icon={<FolderKanban className="h-8 w-8" />}
                  title="Nenhum projeto cadastrado"
                  description="Organize suas metas criando projetos com subtarefas ou peça ao Axiom para te ajudar a estruturar."
                  action={{
                    label: 'Novo Projeto',
                    onClick: () => setProjectDialogOpen(true),
                  }}
                  secondaryAction={{
                    label: 'Pedir ao Axiom',
                    onClick: () => navigate('/'),
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {projects.map((project) => {
                    const tasks = getProjectTasks(project.id);
                    const isExpanded = expandedProject === project.id;
                    return (
                      <Card key={project.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">{project.title}</CardTitle>
                                <Badge className={cn(statusColors[project.status])}>{statusLabels[project.status]}</Badge>
                              </div>
                              {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select value={project.status} onValueChange={(v: Project['status']) => updateProjectStatus(project.id, v)}>
                                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Ativo</SelectItem>
                                  <SelectItem value="paused">Pausado</SelectItem>
                                  <SelectItem value="completed">Concluído</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingProject({ ...project }); setEditProjectDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteProject(project.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3">
                            <Progress value={project.progress} className="flex-1" />
                            <span className="text-sm text-muted-foreground">{project.progress}%</span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Button variant="ghost" className="w-full justify-between" onClick={() => setExpandedProject(isExpanded ? null : project.id)}>
                            <span>Subtarefas ({tasks.length})</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          {isExpanded && (
                            <div className="mt-4 space-y-2">
                              {tasks.map((task) => (
                                <div key={task.id} className="flex items-center gap-2 group">
                                  <Checkbox checked={task.completed} onCheckedChange={(checked) => toggleProjectTask(task.id, checked as boolean, project.id)} />
                                  <span className={cn('flex-1', task.completed && 'line-through text-muted-foreground')}>{task.title}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteProjectTask(task.id, project.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <div className="flex gap-2 mt-3">
                                <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder="Nova subtarefa" onKeyDown={(e) => e.key === 'Enter' && addProjectTask(project.id)} />
                                <Button onClick={() => addProjectTask(project.id)}><Plus className="h-4 w-4" /></Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

export default function Execution() {
  return (
    <PageErrorBoundary pageName="Execução">
      <ExecutionContent />
    </PageErrorBoundary>
  );
}
