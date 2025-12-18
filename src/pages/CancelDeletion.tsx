import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { StarryBackground } from "@/components/ui/starry-background";

type ActionType = "cancel" | "confirm";

export default function CancelDeletion() {
  const { token, action } = useParams<{ token: string; action?: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "not_found">("loading");
  const [message, setMessage] = useState("");
  const [actionType, setActionType] = useState<ActionType>("cancel");

  useEffect(() => {
    // Determine action type from URL path
    const path = window.location.pathname;
    if (path.includes("confirm-deletion")) {
      setActionType("confirm");
    } else {
      setActionType("cancel");
    }
  }, []);

  useEffect(() => {
    if (token) {
      processAction();
    }
  }, [token, actionType]);

  const processAction = async () => {
    try {
      if (actionType === "cancel") {
        // Cancel deletion
        const { data, error } = await supabase
          .from("scheduled_deletions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("confirmation_token", token)
          .eq("status", "pending")
          .select("user_id")
          .single();

        if (error || !data) {
          // Check if already cancelled or executed
          const { data: existing } = await supabase
            .from("scheduled_deletions")
            .select("status")
            .eq("confirmation_token", token)
            .single();

          if (existing?.status === "cancelled") {
            setStatus("success");
            setMessage("Esta solicitação de exclusão já foi cancelada anteriormente.");
          } else if (existing?.status === "executed") {
            setStatus("error");
            setMessage("Esta conta já foi excluída e não pode ser recuperada.");
          } else {
            setStatus("not_found");
            setMessage("Link de cancelamento inválido ou expirado.");
          }
          return;
        }

        // Clear deletion_scheduled_for from profile
        await supabase
          .from("profiles")
          .update({ deletion_scheduled_for: null })
          .eq("id", data.user_id);

        setStatus("success");
        setMessage("Sua solicitação de exclusão foi cancelada com sucesso! Sua conta está segura.");
      } else {
        // Confirm deletion
        const { data, error } = await supabase
          .from("scheduled_deletions")
          .update({
            status: "confirmed",
            confirmed: true,
          })
          .eq("confirmation_token", token)
          .eq("status", "pending")
          .select("scheduled_for")
          .single();

        if (error || !data) {
          const { data: existing } = await supabase
            .from("scheduled_deletions")
            .select("status")
            .eq("confirmation_token", token)
            .single();

          if (existing?.status === "confirmed") {
            setStatus("success");
            setMessage("Sua exclusão já foi confirmada. A conta será excluída na data agendada.");
          } else if (existing?.status === "executed") {
            setStatus("error");
            setMessage("Esta conta já foi excluída.");
          } else if (existing?.status === "cancelled") {
            setStatus("error");
            setMessage("Esta solicitação de exclusão foi cancelada.");
          } else {
            setStatus("not_found");
            setMessage("Link de confirmação inválido ou expirado.");
          }
          return;
        }

        const scheduledDate = new Date(data.scheduled_for).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        });

        setStatus("success");
        setMessage(`Exclusão confirmada. Sua conta será permanentemente excluída em ${scheduledDate}. Você ainda pode cancelar até esta data.`);
      }
    } catch (error) {
      console.error("[CancelDeletion] Error:", error);
      setStatus("error");
      setMessage("Ocorreu um erro ao processar sua solicitação.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      <StarryBackground />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "loading" && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            {status === "success" && actionType === "cancel" && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
            {status === "success" && actionType === "confirm" && (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            {(status === "error" || status === "not_found") && (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
            {status === "loading" && "Processando..."}
            {status === "success" && actionType === "cancel" && "Cancelamento Realizado"}
            {status === "success" && actionType === "confirm" && "Exclusão Confirmada"}
            {status === "error" && "Erro"}
            {status === "not_found" && "Link Inválido"}
          </CardTitle>
          <CardDescription className="mt-2">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status !== "loading" && (
            <Button onClick={() => navigate("/auth")} className="w-full">
              {status === "success" && actionType === "cancel" 
                ? "Fazer Login" 
                : "Ir para Login"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
