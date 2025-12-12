import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ title: '', description: '' });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadProjects();
      loadProjectTasks();
    }
  }, [user]);

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao carregar projetos', variant: 'destructive' });
    } else {
      setProjects((data || []) as Project[]);
    }
    setLoading(false);
  };

  const loadProjectTasks = async () => {
    const { data } = await supabase.from('project_tasks').select('*');
    setProjectTasks(data || []);
  };

  const createProject = async () => {
    if (!newProject.title.trim()) return;

    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      title: newProject.title,
      description: newProject.description || null,
    });

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao criar projeto', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Projeto criado!' });
      setNewProject({ title: '', description: '' });
      setDialogOpen(false);
      loadProjects();
    }
  };

  const updateProject = async () => {
    if (!editingProject) return;

    const { error } = await supabase
      .from('projects')
      .update({
        title: editingProject.title,
        description: editingProject.description,
      })
      .eq('id', editingProject.id);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao atualizar projeto', variant: 'destructive' });
    } else {
      toast({ title: 'Sucesso', description: 'Projeto atualizado!' });
      setEditDialogOpen(false);
      setEditingProject(null);
      loadProjects();
    }
  };

  const updateProjectStatus = async (projectId: string, status: Project['status']) => {
    await supabase.from('projects').update({ status }).eq('id', projectId);
    loadProjects();
  };

  const deleteProject = async (projectId: string) => {
    await supabase.from('projects').delete().eq('id', projectId);
    loadProjects();
  };

  const openEditDialog = (project: Project) => {
    setEditingProject({ ...project });
    setEditDialogOpen(true);
  };

  const addProjectTask = async (projectId: string) => {
    if (!newTaskTitle.trim()) return;

    await supabase.from('project_tasks').insert({
      project_id: projectId,
      user_id: user?.id,
      title: newTaskTitle,
    });

    setNewTaskTitle('');
    loadProjectTasks();
    updateProjectProgress(projectId);
  };

  const toggleProjectTask = async (taskId: string, completed: boolean, projectId: string) => {
    await supabase.from('project_tasks').update({ completed }).eq('id', taskId);
    loadProjectTasks();
    updateProjectProgress(projectId);
  };

  const deleteProjectTask = async (taskId: string, projectId: string) => {
    await supabase.from('project_tasks').delete().eq('id', taskId);
    loadProjectTasks();
    updateProjectProgress(projectId);
  };

  const updateProjectProgress = async (projectId: string) => {
    const tasks = projectTasks.filter((t) => t.project_id === projectId);
    const completed = tasks.filter((t) => t.completed).length;
    const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    await supabase.from('projects').update({ progress }).eq('id', projectId);
    loadProjects();
  };

  const getProjectTasks = (projectId: string) => {
    return projectTasks.filter((t) => t.project_id === projectId);
  };

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Projetos</h1>
            <p className="text-muted-foreground">Gerencie seus projetos e subtarefas</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Projeto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder="Nome do projeto"
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <Button onClick={createProject} className="w-full">
                  Criar Projeto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Projeto</DialogTitle>
            </DialogHeader>
            {editingProject && (
              <div className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editingProject.title}
                    onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={editingProject.description || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                  />
                </div>
                <Button onClick={updateProject} className="w-full">
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
        ) : projects.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Nenhum projeto cadastrado</p>
          </Card>
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
                          <Badge className={cn(statusColors[project.status])}>
                            {statusLabels[project.status]}
                          </Badge>
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={project.status}
                          onValueChange={(v: Project['status']) => updateProjectStatus(project.id, v)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativo</SelectItem>
                            <SelectItem value="paused">Pausado</SelectItem>
                            <SelectItem value="completed">Concluído</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteProject(project.id)}
                        >
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
                    <Button
                      variant="ghost"
                      className="w-full justify-between"
                      onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                    >
                      <span>Subtarefas ({tasks.length})</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {isExpanded && (
                      <div className="mt-4 space-y-2">
                        {tasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-2 group">
                            <Checkbox
                              checked={task.completed}
                              onCheckedChange={(checked) =>
                                toggleProjectTask(task.id, checked as boolean, project.id)
                              }
                            />
                            <span className={cn('flex-1', task.completed && 'line-through text-muted-foreground')}>
                              {task.title}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                              onClick={() => deleteProjectTask(task.id, project.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3">
                          <Input
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Nova subtarefa"
                            onKeyDown={(e) => e.key === 'Enter' && addProjectTask(project.id)}
                          />
                          <Button onClick={() => addProjectTask(project.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
