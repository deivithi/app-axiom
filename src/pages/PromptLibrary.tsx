import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Star, Filter, Loader2, Plus, Sparkles, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
interface Prompt {
  id: string;
  title: string;
  prompt_text: string;
  category: string;
  is_pinned: boolean;
  ai_diagnosis: string | null;
  optimized_prompt: string | null;
  analysis_score: number | null;
  analysis_status: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function PromptLibrary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "analyzed" | "favorites">("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState({ title: "", prompt_text: "", category: "geral" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) loadPrompts();
  }, [user, filter]);

  const loadPrompts = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("prompt_library")
      .select("*")
      .eq("user_id", user.id);

    if (filter === "favorites") {
      query = query.eq("is_pinned", true);
    }

    const { data, error } = await query
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error loading prompts:", error);
      toast.error("Erro ao carregar prompts");
    } else {
      setPrompts(data || []);
    }
    setLoading(false);
  };

  const createPrompt = async () => {
    if (!user || !newPrompt.title.trim() || !newPrompt.prompt_text.trim()) {
      toast.error("Preencha título e texto do prompt");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("prompt_library")
        .insert({
          user_id: user.id,
          title: newPrompt.title,
          prompt_text: newPrompt.prompt_text,
          category: newPrompt.category,
          analysis_status: "analyzing"
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Prompt salvo! Gerando diagnóstico...");
      setIsCreateOpen(false);
      setNewPrompt({ title: "", prompt_text: "", category: "geral" });

      // Generate diagnosis in background
      generateDiagnosis(data.id, newPrompt.prompt_text);
      loadPrompts();
    } catch (error) {
      console.error("Error creating prompt:", error);
      toast.error("Erro ao criar prompt");
    }
    setCreating(false);
  };

  const generateDiagnosis = async (promptId: string, promptText: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: { content: promptText, type: "prompt" }
      });

      if (error) throw error;

      // Use the score directly from the API response
      const score = data.analysisScore || null;

      await supabase
        .from("prompt_library")
        .update({
          ai_diagnosis: data.insights,
          optimized_prompt: data.optimizedPrompt,
          analysis_score: score,
          analysis_status: "analyzed"
        })
        .eq("id", promptId);

      loadPrompts();
      toast.success("Diagnóstico gerado!");
    } catch (error) {
      console.error("Error generating diagnosis:", error);
      await supabase
        .from("prompt_library")
        .update({ analysis_status: "failed" })
        .eq("id", promptId);
    }
  };

  const toggleFavorite = async (prompt: Prompt) => {
    const { error } = await supabase
      .from("prompt_library")
      .update({ is_pinned: !prompt.is_pinned })
      .eq("id", prompt.id);

    if (error) {
      toast.error("Erro ao atualizar favorito");
    } else {
      loadPrompts();
    }
  };

  const filteredPrompts = prompts.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.prompt_text.toLowerCase().includes(search.toLowerCase())
  );

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number | null) => {
    if (!score) return "bg-muted";
    if (score >= 8) return "bg-green-500/10 border-green-500/20";
    if (score >= 5) return "bg-yellow-500/10 border-yellow-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="dashboard-header-apple" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <h1>
            <Sparkles />
            Biblioteca de Prompts
          </h1>
          <p>{prompts.length} prompts salvos • Otimize seus prompts com IA</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Prompt</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Título</Label>
                <Input
                  placeholder="Ex: Análise de Finanças"
                  value={newPrompt.title}
                  onChange={e => setNewPrompt(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={newPrompt.category} onValueChange={v => setNewPrompt(p => ({ ...p, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral</SelectItem>
                    <SelectItem value="escrita">Escrita</SelectItem>
                    <SelectItem value="código">Código</SelectItem>
                    <SelectItem value="análise">Análise</SelectItem>
                    <SelectItem value="criativo">Criativo</SelectItem>
                    <SelectItem value="negócios">Negócios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Texto do Prompt</Label>
                <Textarea
                  placeholder="Digite seu prompt aqui..."
                  className="min-h-[200px]"
                  value={newPrompt.prompt_text}
                  onChange={e => setNewPrompt(p => ({ ...p, prompt_text: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use variáveis como {"{{axiom_score}}"}, {"{{saldo_total}}"}, {"{{tarefas_pendentes}}"} para dados dinâmicos
                </p>
              </div>
              <Button onClick={createPrompt} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {creating ? "Salvando..." : "Salvar e Analisar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prompts..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="favorites">Favoritos ★</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Prompts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPrompts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {search ? "Nenhum prompt encontrado" : "Nenhum prompt salvo ainda"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Dica: No chat, diga "salva esse prompt: [seu prompt]"
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map(prompt => (
            <div
              key={prompt.id}
              className="prompt-card-apple group cursor-pointer"
              onClick={() => navigate(`/prompts/${prompt.id}`)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-sf-display text-base font-semibold line-clamp-1">{prompt.title}</h3>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {prompt.category}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 transition-transform duration-200"
                    onClick={e => {
                      e.stopPropagation();
                      toggleFavorite(prompt);
                    }}
                  >
                    <Star className={`h-4 w-4 transition-all duration-200 ${prompt.is_pinned ? "fill-yellow-500 text-yellow-500 scale-110" : ""}`} />
                  </Button>
                </div>
                
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {prompt.prompt_text}
                </p>

                {/* Status/Score */}
                {prompt.analysis_status === "analyzing" ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analisando...
                  </div>
                ) : prompt.analysis_score ? (
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'score-badge-apple',
                      prompt.analysis_score >= 8 ? 'high' : prompt.analysis_score >= 5 ? 'medium' : 'low'
                    )}>
                      {prompt.analysis_score}/10
                    </span>
                    {prompt.analysis_score < 8 && prompt.optimized_prompt && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Melhoria disponível
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Usage stats */}
                {prompt.usage_count > 0 && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Usado {prompt.usage_count}x
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
    </AppLayout>
  );
}
