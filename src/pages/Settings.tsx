import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Save, Trash2, AlertTriangle, Upload, User, Target, Compass, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type PersonalityMode = "direto" | "sabio" | "parceiro";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userContext, setUserContext] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [personalityMode, setPersonalityMode] = useState<PersonalityMode>("direto");
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, user_context, avatar_url, personality_mode")
      .eq("id", user?.id)
      .maybeSingle();

    if (!error && data) {
      setFullName(data.full_name || "");
      setUserContext(data.user_context || "");
      setAvatarUrl(data.avatar_url || null);
      setPersonalityMode((data.personality_mode as PersonalityMode) || "direto");
    }
    setLoading(false);
  };

  const updatePersonalityMode = async (mode: PersonalityMode) => {
    setSavingMode(true);
    const { error } = await supabase
      .from("profiles")
      .update({ personality_mode: mode })
      .eq("id", user?.id);

    if (error) {
      toast.error("Erro ao alterar modo de personalidade");
    } else {
      setPersonalityMode(mode);
      const modeNames = { direto: "Direto 🎯", sabio: "Sábio 🧘", parceiro: "Parceiro 🤝" };
      toast.success(`Modo alterado para ${modeNames[mode]}`);
    }
    setSavingMode(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithTimestamp })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithTimestamp);
      toast.success("Foto atualizada! 📸");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Erro ao fazer upload da foto");
    }

    setUploadingAvatar(false);
  };

  const removeAvatar = async () => {
    if (!user) return;

    try {
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([`${user.id}/avatar.png`, `${user.id}/avatar.jpg`, `${user.id}/avatar.jpeg`, `${user.id}/avatar.webp`]);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(null);
      toast.success("Foto removida");
    } catch (error) {
      console.error('Remove error:', error);
      toast.error("Erro ao remover foto");
    }
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
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground">⚙️ Configurações</h1>

        {/* Foto de Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📸 Foto de Perfil
            </CardTitle>
            <CardDescription>
              Sua foto aparecerá como avatar no chat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" asChild disabled={uploadingAvatar}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Escolher foto
                    </span>
                  </Button>
                </Label>
                <input 
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                {avatarUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeAvatar}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover foto
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modo de Personalidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🎭 Modo de Personalidade do Axiom
            </CardTitle>
            <CardDescription>
              Escolha como o Axiom se comunica com você. A essência permanece a mesma, apenas o tom muda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Direto */}
              <button
                onClick={() => updatePersonalityMode("direto")}
                disabled={savingMode}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  personalityMode === "direto" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Direto</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Brutal, sem rodeios. "Quando vai parar de se enganar?"
                </p>
              </button>

              {/* Sábio */}
              <button
                onClick={() => updatePersonalityMode("sabio")}
                disabled={savingMode}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  personalityMode === "sabio" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Sábio</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reflexivo, guia com perguntas. "O que seus hábitos estão dizendo?"
                </p>
              </button>

              {/* Parceiro */}
              <button
                onClick={() => updatePersonalityMode("parceiro")}
                disabled={savingMode}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  personalityMode === "parceiro" 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Handshake className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Parceiro</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Empático, apoio prático. "Qual tarefa pequena te ajudo hoje?"
                </p>
              </button>
            </div>
            {savingMode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Alterando modo...
              </div>
            )}
          </CardContent>
        </Card>

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
