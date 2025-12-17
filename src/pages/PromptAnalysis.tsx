import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Copy, Sparkles, Check, Loader2, RefreshCw, Play, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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
  analysis_problems: string[] | null;
  analysis_strengths: string[] | null;
  improvements: unknown;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

export default function PromptAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);
  const [showFullDiagnosis, setShowFullDiagnosis] = useState(false);

  useEffect(() => {
    if (user && id) loadPrompt();
  }, [user, id]);

  const loadPrompt = async () => {
    if (!user || !id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("prompt_library")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Error loading prompt:", error);
      toast.error("Prompt não encontrado");
      navigate("/prompts");
    } else {
      setPrompt(data);
    }
    setLoading(false);
  };

  const regenerateDiagnosis = async () => {
    if (!prompt) return;
    setRegenerating(true);

    try {
      await supabase
        .from("prompt_library")
        .update({ analysis_status: "analyzing" })
        .eq("id", prompt.id);

      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: { content: prompt.prompt_text, type: "prompt" }
      });

      if (error) throw error;

      let score = null;
      const scoreMatch = data.insights?.match(/(\d+)\/10/);
      if (scoreMatch) score = parseInt(scoreMatch[1]);

      await supabase
        .from("prompt_library")
        .update({
          ai_diagnosis: data.insights,
          optimized_prompt: data.optimizedPrompt,
          analysis_score: score,
          analysis_status: "analyzed"
        })
        .eq("id", prompt.id);

      loadPrompt();
      toast.success("Diagnóstico regenerado!");
    } catch (error) {
      console.error("Error regenerating:", error);
      toast.error("Erro ao regenerar diagnóstico");
    }
    setRegenerating(false);
  };

  const copyToClipboard = async (text: string, type: "original" | "optimized") => {
    await navigator.clipboard.writeText(text);
    if (type === "original") {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedOptimized(true);
      setTimeout(() => setCopiedOptimized(false), 2000);
    }
    toast.success("Copiado!");
  };

  const toggleFavorite = async () => {
    if (!prompt) return;
    const { error } = await supabase
      .from("prompt_library")
      .update({ is_pinned: !prompt.is_pinned })
      .eq("id", prompt.id);

    if (!error) {
      setPrompt(p => p ? { ...p, is_pinned: !p.is_pinned } : null);
    }
  };

  const trackAndUse = async (useOptimized: boolean) => {
    if (!prompt) return;

    // Update usage count
    await supabase
      .from("prompt_library")
      .update({
        usage_count: (prompt.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq("id", prompt.id);

    const textToCopy = useOptimized && prompt.optimized_prompt
      ? prompt.optimized_prompt
      : prompt.prompt_text;

    await navigator.clipboard.writeText(textToCopy);
    toast.success(`Prompt ${useOptimized ? "otimizado" : "original"} copiado! Cole no chat para usar.`);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number | null) => {
    if (!score) return "Não analisado";
    if (score >= 9) return "Excelente";
    if (score >= 7) return "Bom";
    if (score >= 5) return "Razoável";
    return "Precisa melhorar";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!prompt) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/prompts")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{prompt.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{prompt.category}</Badge>
              {prompt.usage_count > 0 && (
                <span className="text-xs text-muted-foreground">
                  Usado {prompt.usage_count}x
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFavorite}>
            <Star className={`h-5 w-5 ${prompt.is_pinned ? "fill-yellow-500 text-yellow-500" : ""}`} />
          </Button>
        </div>

        {/* Score Card */}
        {prompt.analysis_status === "analyzed" && prompt.analysis_score && (
          <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`text-5xl font-bold ${getScoreColor(prompt.analysis_score)}`}>
                    {prompt.analysis_score}
                    <span className="text-xl text-muted-foreground">/10</span>
                  </div>
                  <div>
                    <p className="font-medium">{getScoreLabel(prompt.analysis_score)}</p>
                    <p className="text-sm text-muted-foreground">Qualidade do prompt</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={regenerateDiagnosis} disabled={regenerating}>
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2 hidden md:inline">Regenerar</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analyzing State */}
        {prompt.analysis_status === "analyzing" && (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-3" />
              <span>Analisando prompt...</span>
            </CardContent>
          </Card>
        )}

        {/* Diagnosis */}
        {prompt.ai_diagnosis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Diagnóstico do Axiom
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`prose prose-sm dark:prose-invert max-w-none ${!showFullDiagnosis && "line-clamp-6"}`}>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {prompt.ai_diagnosis}
                </pre>
              </div>
              {prompt.ai_diagnosis.length > 500 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowFullDiagnosis(!showFullDiagnosis)}
                >
                  {showFullDiagnosis ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" /> Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" /> Ver completo
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparison */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Original */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Prompt Original</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(prompt.prompt_text, "original")}
                >
                  {copiedOriginal ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {prompt.analysis_score && (
                <CardDescription className={getScoreColor(prompt.analysis_score)}>
                  {prompt.analysis_score}/10
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {prompt.prompt_text}
                </pre>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => trackAndUse(false)}
              >
                <Play className="h-4 w-4 mr-2" />
                Usar Original
              </Button>
            </CardContent>
          </Card>

          {/* Optimized */}
          {prompt.optimized_prompt && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Versão Otimizada
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(prompt.optimized_prompt!, "optimized")}
                  >
                    {copiedOptimized ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <CardDescription className="text-green-500">
                  Melhorado pelo Axiom
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-background/50 rounded-lg p-4 text-sm border border-primary/20">
                  <pre className="whitespace-pre-wrap font-mono text-xs">
                    {prompt.optimized_prompt}
                  </pre>
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => trackAndUse(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Usar Otimizado
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Variables Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variáveis Dinâmicas</CardTitle>
            <CardDescription>
              Use estas variáveis no seu prompt para injetar dados reais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {[
                { var: "{{usuario_nome}}", desc: "Seu nome" },
                { var: "{{axiom_score}}", desc: "Score atual" },
                { var: "{{score_variacao}}", desc: "Variação do score" },
                { var: "{{saldo_total}}", desc: "Saldo das contas" },
                { var: "{{gastos_mes}}", desc: "Gastos do mês" },
                { var: "{{receitas_mes}}", desc: "Receitas do mês" },
                { var: "{{tarefas_pendentes}}", desc: "Tarefas pendentes" },
                { var: "{{projetos_ativos}}", desc: "Projetos ativos" },
                { var: "{{habitos_completos}}", desc: "Hábitos de hoje" },
                { var: "{{data_hoje}}", desc: "Data atual" },
                { var: "{{dia_semana}}", desc: "Dia da semana" },
                { var: "{{hora_atual}}", desc: "Hora atual" }
              ].map(v => (
                <div key={v.var} className="flex flex-col p-2 bg-muted/50 rounded">
                  <code className="text-primary font-mono">{v.var}</code>
                  <span className="text-muted-foreground">{v.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
