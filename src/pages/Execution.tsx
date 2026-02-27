import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { AppleCard } from '@/components/ui/apple-card';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

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

export default function Execution() {
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
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'task' | 'project' | 'projectTask'; id: string; projectId?: string; label: string } | null>(null);
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
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(200);
    setTasks((data || []) as Task[]);
    setLoading(false);
  };

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(100);
    setProjects((data || []) as Project[]);
  };

  const loadProjectTasks = async () => {
    const { data } = await supabase.from('project_tasks').select('*').limit(500);
    setProjectTasks(data || []);
  };

  // Task operations
  const createTask = async () => {
    if (!newTask.title.trim()) return;
    const { error } = await supabase.from('tasks').insert({
      user_id: user?.id,
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      status: 'todo',
    });
    if (error) { toast({ title: 'Erro', description: 'Erro ao criar tarefa', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Tarefa criada!' });
    setNewTask({ title: '', description: '', priority: 'medium' });
    setTaskDialogOpen(false);
    loadTasks();
  };

  const updateTask = async () => {
    if (!editingTask) return;
    if (!editingTask.title?.trim()) {
      toast({ title: 'Erro', description: 'O título não pode estar vazio', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('tasks').update({
        title: editingTask.title.trim(),
        description: editingTask.description,
        priority: editingTask.priority,
        status: editingTask.status,
      }).eq('id', editingTask.id);
      if (error) { toast({ title: 'Erro', description: 'Erro ao atualizar tarefa', variant: 'destructive' }); return; }
      toast({ title: 'Sucesso', description: 'Tarefa atualizada!' });
      setEditTaskDialogOpen(false);
      setEditingTask(null);
      loadTasks();
    } catch (e) { toast({ title: 'Erro', description: 'Erro inesperado', variant: 'destructive' }); }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    if (newStatus === 'done' && task) {
      notifyAction('complete_task', 'tasks', `✓ Tarefa "${task.title}" concluída!`);
    }
  };

  const confirmDeleteItem = (type: 'task' | 'project' | 'projectTask', id: string, label: string, projectId?: string) => {
    setDeleteTarget({ type, id, projectId, label });
  };

  const executeDeleteItem = async () => {
    if (!deleteTarget) return;
    const { type, id, projectId } = deleteTarget;
    setDeleteTarget(null);
    try {
      if (type === 'task') {
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) { toast({ title: 'Erro', description: `Erro ao excluir tarefa: ${error.message}`, variant: 'destructive' }); return; }
        setTasks(prev => prev.filter(t => t.id !== id));
        toast({ title: 'Excluído', description: 'Tarefa excluída' });
      } else if (type === 'project') {
        await supabase.from('project_tasks').delete().eq('project_id', id);
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) { toast({ title: 'Erro', description: `Erro ao excluir projeto: ${error.message}`, variant: 'destructive' }); return; }
        loadProjects();
        loadProjectTasks();
        toast({ title: 'Excluído', description: 'Projeto excluído' });
      } else if (type === 'projectTask') {
        const { error } = await supabase.from('project_tasks').delete().eq('id', id);
        if (error) { toast({ title: 'Erro', description: `Erro ao excluir sub-tarefa: ${error.message}`, variant: 'destructive' }); return; }
        loadProjectTasks();
        if (projectId) updateProjectProgress(projectId);
        toast({ title: 'Excluído', description: 'Sub-tarefa excluída' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: `Erro inesperado: ${e?.message || 'desconhecido'}`, variant: 'destructive' });
    }
  };

  // Project operations
  const createProject = async () => {
    if (!newProject.title.trim()) return;
    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      title: newProject.title,
      description: newProject.description || null,
    });
    if (error) { toast({ title: 'Erro', description: 'Erro ao criar projeto', variant: 'destructive' }); return; }
    toast({ title: 'Sucesso', description: 'Projeto criado!' });
    setNewProject({ title: '', description: '' });
    setProjectDialogOpen(false);
    loadProjects();
  };

  const updateProject = async () => {
    if (!editingProject) return;
    await supabase.from('projects').update({
      title: editingProject.title,
      description: editingProject.description,
    }).eq('id', editingProject.id);
    toast({ title: 'Sucesso', description: 'Projeto atualizado!' });
    setEditProjectDialogOpen(false);
    setEditingProject(null);
    loadProjects();
  };

  const updateProjectStatus = async (projectId: string, status: Project['status']) => {
    await supabase.from('projects').update({ status }).eq('id', projectId);
    loadProjects();
  };

  const addProjectTask = async (projectId: string) => {
    if (!newSubtaskTitle.trim()) return;
    await supabase.from('project_tasks').insert({
      project_id: projectId,
      user_id: user?.id,
      title: newSubtaskTitle,
    });
    setNewSubtaskTitle('');
    loadProjectTasks();
    updateProjectProgress(projectId);
  };

  const toggleProjectTask = async (taskId: string, completed: boolean, projectId: string) => {
    await supabase.from('project_tasks').update({ completed }).eq('id', taskId);
    loadProjectTasks();
    updateProjectProgress(projectId);
  };

  const updateProjectProgress = async (projectId: string) => {
    const tasks = projectTasks.filter(t => t.project_id === projectId);
    const completed = tasks.filter(t => t.completed).length;
    const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    await supabase.from('projects').update({ progress }).eq('id', projectId);
    loadProjects();
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
    <>
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
            <PageSkeleton cards={3} />
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
                            <AnimatePresence>
                              {tasks.filter(t => t.status === col.id).map((task) => (
                                <motion.div
                                  key={task.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.9 }}
                                  draggable
                                  onDragStart={(e: any) => handleDragStart(e, task.id)}
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirmDeleteItem('task', task.id, task.title)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
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
                    <AnimatePresence>
                      {projects.map((project) => {
                        const tasks = getProjectTasks(project.id);
                        const isExpanded = expandedProject === project.id;
                        return (
                          <motion.div
                            key={project.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <AppleCard elevation={1}>
                              <div className="p-4 sm:p-6 pb-2">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-lg font-semibold tracking-tight">{project.title}</h3>
                                      <Badge className={cn(statusColors[project.status])}>{statusLabels[project.status]}</Badge>
                                    </div>
                                    {project.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{project.description}</p>}
                                  </div>
                                  <div className="flex justify-between sm:justify-end items-center gap-2 w-full sm:w-auto">
                                    <Select value={project.status} onValueChange={(v: Project['status']) => updateProjectStatus(project.id, v)}>
                                      <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Ativo</SelectItem>
                                        <SelectItem value="paused">Pausado</SelectItem>
                                        <SelectItem value="completed">Concluído</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setEditingProject({ ...project }); setEditProjectDialogOpen(true); }}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => confirmDeleteItem('project', project.id, project.title)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                  <Progress value={project.progress} className="flex-1 h-2" />
                                  <span className="text-sm font-medium text-muted-foreground w-9">{project.progress}%</span>
                                </div>
                              </div>

                              <div className="p-4 sm:p-6 pt-0 mt-4">
                                <Button variant="ghost" className="w-full justify-between hover:bg-muted/50 transition-colors" onClick={() => setExpandedProject(isExpanded ? null : project.id)}>
                                  <span className="font-medium">Subtarefas ({tasks.length})</span>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="pt-4 space-y-2 overflow-hidden"
                                    >
                                      {tasks.map((task) => (
                                        <div key={task.id} className="flex items-center gap-2 group p-2 hover:bg-muted/30 rounded-lg transition-colors">
                                          <Checkbox checked={task.completed} onCheckedChange={(checked) => toggleProjectTask(task.id, checked as boolean, project.id)} />
                                          <span className={cn('flex-1 text-sm', task.completed && 'line-through text-muted-foreground')}>{task.title}</span>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" onClick={() => confirmDeleteItem('projectTask', task.id, task.title, project.id)}>
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      ))}
                                      <div className="flex gap-2 mt-4">
                                        <Input value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} placeholder="Nova subtarefa" onKeyDown={(e) => e.key === 'Enter' && addProjectTask(project.id)} className="h-9 bg-background/50" />
                                        <Button size="sm" onClick={() => addProjectTask(project.id)} className="h-9 w-9 p-0"><Plus className="h-4 w-4" /></Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </AppleCard>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </AppLayout>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.label}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
