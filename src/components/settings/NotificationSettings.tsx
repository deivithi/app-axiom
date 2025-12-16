import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff, Loader2, TestTube, AlertCircle } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationSettings() {
  const {
    permission,
    isSubscribed,
    loading,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    isSupported
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔔 Notificações Push
          </CardTitle>
          <CardDescription>
            Receba notificações mesmo quando não estiver no app
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Seu navegador não suporta notificações push. Tente usar Chrome, Firefox ou Edge.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ ...preferences, [key]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔔 Notificações Push
        </CardTitle>
        <CardDescription>
          Receba notificações mesmo quando não estiver no app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {isSubscribed ? (
              <Bell className="h-5 w-5 text-primary" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isSubscribed ? "Notificações Ativas" : "Notificações Desativadas"}
              </p>
              <p className="text-xs text-muted-foreground">
                {permission === 'denied' 
                  ? "Permissão negada no navegador" 
                  : isSubscribed 
                    ? "Você receberá alertas do Axiom" 
                    : "Ative para receber alertas"}
              </p>
            </div>
          </div>
          <Button
            variant={isSubscribed ? "outline" : "default"}
            onClick={handleToggle}
            disabled={loading || permission === 'denied'}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSubscribed ? (
              "Desativar"
            ) : (
              "Ativar"
            )}
          </Button>
        </div>

        {permission === 'denied' && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Notificações foram bloqueadas. Vá nas configurações do navegador para permitir.
            </p>
          </div>
        )}

        {/* Preferences */}
        {isSubscribed && (
          <>
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-4">Tipos de Notificação</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reminders" className="flex items-center gap-2 cursor-pointer">
                    <span>⏰</span>
                    <div>
                      <p className="font-medium">Lembretes</p>
                      <p className="text-xs text-muted-foreground">Alertas de lembretes agendados</p>
                    </div>
                  </Label>
                  <Switch
                    id="reminders"
                    checked={preferences.reminders}
                    onCheckedChange={(v) => handlePreferenceChange('reminders', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="proactive" className="flex items-center gap-2 cursor-pointer">
                    <span>❓</span>
                    <div>
                      <p className="font-medium">Perguntas do Axiom</p>
                      <p className="text-xs text-muted-foreground">Perguntas proativas diárias</p>
                    </div>
                  </Label>
                  <Switch
                    id="proactive"
                    checked={preferences.proactive_questions}
                    onCheckedChange={(v) => handlePreferenceChange('proactive_questions', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="score" className="flex items-center gap-2 cursor-pointer">
                    <span>📉</span>
                    <div>
                      <p className="font-medium">Quedas de Score</p>
                      <p className="text-xs text-muted-foreground">Alertas quando seu score cair significativamente</p>
                    </div>
                  </Label>
                  <Switch
                    id="score"
                    checked={preferences.score_drops}
                    onCheckedChange={(v) => handlePreferenceChange('score_drops', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="weekly" className="flex items-center gap-2 cursor-pointer">
                    <span>📊</span>
                    <div>
                      <p className="font-medium">Relatório Semanal</p>
                      <p className="text-xs text-muted-foreground">Resumo toda segunda-feira</p>
                    </div>
                  </Label>
                  <Switch
                    id="weekly"
                    checked={preferences.weekly_report}
                    onCheckedChange={(v) => handlePreferenceChange('weekly_report', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="bills" className="flex items-center gap-2 cursor-pointer">
                    <span>💰</span>
                    <div>
                      <p className="font-medium">Contas a Pagar</p>
                      <p className="text-xs text-muted-foreground">Alertas de despesas pendentes</p>
                    </div>
                  </Label>
                  <Switch
                    id="bills"
                    checked={preferences.bills_due}
                    onCheckedChange={(v) => handlePreferenceChange('bills_due', v)}
                  />
                </div>
              </div>
            </div>

            {/* Test Button */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                onClick={sendTestNotification}
                className="w-full"
              >
                <TestTube className="h-4 w-4 mr-2" />
                Enviar Notificação de Teste
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
