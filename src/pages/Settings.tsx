import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Save, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [fullName, setFullName] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, user_context")
      .eq("id", user?.id)
      .maybeSingle();

    if (!error && data) {
      setFullName(data.full_name || "");
      setUserContext(data.user_context || "");
    }
    setLoading(false);
  };

  const saveContext = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ user_context: userContext })
      .eq("id", user?.id);

    if (error) {
      toast.error("Erro ao salvar contexto");
    } else {
      toast.success("Contexto salvo! O Axiom agora te conhece melhor 🧠");
    }
    setSaving(false);
  };

  const deleteAllData = async () => {
    if (deleteConfirmation !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar");
      return;
    }

    setIsDeleting(true);

    try {
      // Delete from all tables
      await supabase.from("transactions").delete().eq("user_id", user?.id);
      await supabase.from("accounts").delete().eq("user_id", user?.id);
      await supabase.from("habit_logs").delete().eq("user_id", user?.id);
      await supabase.from("habits").delete().eq("user_id", user?.id);
      await supabase.from("project_tasks").delete().eq("user_id", user?.id);
      await supabase.from("projects").delete().eq("user_id", user?.id);
      await supabase.from("reminders").delete().eq("user_id", user?.id);
      await supabase.from("notes").delete().eq("user_id", user?.id);
      await supabase.from("journal_entries").delete().eq("user_id", user?.id);
      await supabase.from("messages").delete().eq("user_id", user?.id);
      await supabase.from("tasks").delete().eq("user_id", user?.id);

      // Reset user context
      await supabase
        .from("profiles")
        .update({ user_context: null })
        .eq("id", user?.id);

      toast.success("Todos os dados foram excluídos. Você está começando do zero! 🔄");
      setIsDeleteDialogOpen(false);
      setDeleteConfirmation("");
      setUserContext("");
    } catch (error) {
      toast.error("Erro ao excluir dados");
    }
    
    setIsDeleting(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">⚙️ Configurações</h1>

        {/* Dados da Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              👤 Dados da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={fullName} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Contexto Pessoal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧠 Contexto Pessoal para o Axiom
            </CardTitle>
            <CardDescription>
              Conte sobre você para que o Axiom te conheça melhor e personalize suas respostas. 
              Inclua objetivos, rotina, desafios, valores, e qualquer informação relevante.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={userContext}
              onChange={e => setUserContext(e.target.value)}
              placeholder="Ex: Tenho 28 anos, sou desenvolvedor em SP. Meu objetivo principal é construir um negócio próprio nos próximos 2 anos. Meus maiores desafios são procrastinação e gestão financeira. Acordo às 7h e trabalho das 9h às 18h. Nos fins de semana gosto de estudar e fazer exercícios..."
              className="min-h-[200px] resize-none"
            />
            <Button onClick={saveContext} disabled={saving} className="w-full sm:w-auto">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Contexto
            </Button>
          </CardContent>
        </Card>

        {/* Zona de Perigo */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Excluir todos os seus dados e começar do zero. Esta ação é IRREVERSÍVEL!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Todos os Dados
            </Button>
          </CardContent>
        </Card>

        {/* Dialog de Confirmação */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Exclusão Total
              </DialogTitle>
              <DialogDescription>
                Esta ação vai excluir TODOS os seus dados: transações, contas, tarefas, hábitos, projetos, lembretes, notas, diário e histórico de mensagens.
                <br /><br />
                <strong>Esta ação NÃO pode ser desfeita!</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Digite <strong>EXCLUIR</strong> para confirmar:</Label>
                <Input
                  value={deleteConfirmation}
                  onChange={e => setDeleteConfirmation(e.target.value)}
                  placeholder="EXCLUIR"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={deleteAllData}
                disabled={deleteConfirmation !== "EXCLUIR" || isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir Tudo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
