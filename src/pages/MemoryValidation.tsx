import { useState } from "react";
import { Check, X, Play, Download, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";

interface TestResult {
  id: string;
  name: string;
  status: "pending" | "running" | "passed" | "failed";
  message?: string;
  duration?: number;
  details?: Record<string, any>;
}

const initialTests: TestResult[] = [
  { id: "test-1", name: "Dashboard de Memória — Estrutura Visual", status: "pending" },
  { id: "test-2", name: "Chat com Contexto — Busca de Memórias", status: "pending" },
  { id: "test-3", name: "Extração Automática — Criação de Memórias", status: "pending" },
  { id: "test-4", name: "Detalhes da Memória — Estrutura Completa", status: "pending" },
  { id: "test-5", name: "Aprendizados — Categorização por Tipo", status: "pending" },
  { id: "test-6", name: "Busca de Memórias — Filtros Funcionais", status: "pending" },
];

export default function MemoryValidation() {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestResult[]>(initialTests);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async (testId: string) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setTests((prev) =>
      prev.map((t) => (t.id === testId ? { ...t, status: "running", message: undefined } : t))
    );

    try {
      const { data, error } = await supabase.functions.invoke("validate-memory-system", {
        body: { userId: user.id, testId },
      });

      if (error) throw error;

      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? {
                ...t,
                status: data.passed ? "passed" : "failed",
                message: data.message,
                duration: data.duration,
                details: data.details,
              }
            : t
        )
      );
    } catch (error: any) {
      setTests((prev) =>
        prev.map((t) =>
          t.id === testId
            ? { ...t, status: "failed", message: `❌ Erro: ${error.message}` }
            : t
        )
      );
    }
  };

  const runAllTests = async () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }

    setIsRunning(true);
    setTests(initialTests);

    for (const test of initialTests) {
      await runTest(test.id);
      // Small delay between tests
      await new Promise((r) => setTimeout(r, 300));
    }

    setIsRunning(false);
    toast.success("Validação completa!");
  };

  const exportReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      userId: user?.id,
      summary: {
        total: tests.length,
        passed: tests.filter((t) => t.status === "passed").length,
        failed: tests.filter((t) => t.status === "failed").length,
        pending: tests.filter((t) => t.status === "pending").length,
      },
      tests: tests.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        message: t.message,
        duration: t.duration,
        details: t.details,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `axiom-memory-validation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  const passedCount = tests.filter((t) => t.status === "passed").length;
  const failedCount = tests.filter((t) => t.status === "failed").length;
  const pendingCount = tests.filter((t) => t.status === "pending").length;
  const progressPercent = tests.length > 0 ? (passedCount / tests.length) * 100 : 0;

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "passed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "failed":
        return <X className="h-5 w-5 text-red-500" />;
      case "running":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "passed":
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Passou</Badge>;
      case "failed":
        return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Falhou</Badge>;
      case "running":
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Executando...</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-4 pl-16 md:pl-6 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              🧠 Validação do Sistema de Memória
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {passedCount}/{tests.length} testes passaram • {progressPercent.toFixed(0)}% completo
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={runAllTests} disabled={isRunning} className="gap-2">
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Executar Todos
                </>
              )}
            </Button>
            <Button variant="outline" onClick={exportReport} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercent} className="h-2" />

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-400">{passedCount}</p>
              <p className="text-sm text-green-400/80">Passaram</p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/20">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-red-400">{failedCount}</p>
              <p className="text-sm text-red-400/80">Falharam</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/50 border-border">
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-muted-foreground">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          {tests.map((test) => (
            <Card key={test.id} className="transition-all hover:border-primary/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-muted">
                      {getStatusIcon(test.status)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{test.name}</p>
                      {test.duration && (
                        <p className="text-xs text-muted-foreground">{test.duration}ms</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(test.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => runTest(test.id)}
                      disabled={test.status === "running" || isRunning}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {test.message && (
                  <div
                    className={`mt-3 p-3 rounded-lg text-sm ${
                      test.status === "passed"
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : test.status === "failed"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {test.message}
                  </div>
                )}

                {test.details && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <pre className="bg-muted/50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Instructions */}
        <Card className="bg-muted/30 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              💡 Como usar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Clique em <strong>"Executar Todos"</strong> para rodar todos os testes</p>
            <p>2. Ou clique no ícone <RefreshCw className="h-3 w-3 inline" /> para rodar um teste individual</p>
            <p>3. Exporte o relatório JSON para análise detalhada</p>
            <p className="text-xs mt-4 opacity-70">
              ⚠️ Alguns testes podem criar memórias de teste no banco de dados.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
