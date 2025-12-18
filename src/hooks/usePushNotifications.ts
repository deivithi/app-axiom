import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// VAPID public key - set this in your .env as VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface NotificationPreferences {
  enabled: boolean;
  reminders: boolean;
  proactive_questions: boolean;
  score_drops: boolean;
  weekly_report: boolean;
  bills_due: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  reminders: true,
  proactive_questions: true,
  score_drops: true,
  weekly_report: true,
  bills_due: true
};

function parsePreferences(json: Json | null): NotificationPreferences {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return DEFAULT_PREFERENCES;
  }
  const obj = json as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : DEFAULT_PREFERENCES.enabled,
    reminders: typeof obj.reminders === 'boolean' ? obj.reminders : DEFAULT_PREFERENCES.reminders,
    proactive_questions: typeof obj.proactive_questions === 'boolean' ? obj.proactive_questions : DEFAULT_PREFERENCES.proactive_questions,
    score_drops: typeof obj.score_drops === 'boolean' ? obj.score_drops : DEFAULT_PREFERENCES.score_drops,
    weekly_report: typeof obj.weekly_report === 'boolean' ? obj.weekly_report : DEFAULT_PREFERENCES.weekly_report,
    bills_due: typeof obj.bills_due === 'boolean' ? obj.bills_due : DEFAULT_PREFERENCES.bills_due,
  };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  // Check current subscription status
  const checkSubscription = useCallback(async () => {
    if (!user || !('serviceWorker' in navigator)) {
      setLoading(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      setPermission(Notification.permission);

      // Load preferences from profile
      const { data } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.notification_preferences) {
        setPreferences(parsePreferences(data.notification_preferences));
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Register service worker
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker não suportado neste navegador');
    }
    return navigator.serviceWorker.register('/sw.js');
  };

  // Request notification permission and subscribe
  const subscribe = async () => {
    if (!user) {
      toast.error('Faça login para ativar notificações');
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      toast.error('Configuração de notificações incompleta');
      return false;
    }

    try {
      setLoading(true);

      // Register service worker
      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Permissão de notificações negada');
        setLoading(false);
        return false;
      }

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      const subscriptionJson = subscription.toJSON();

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth,
          device_name: navigator.userAgent.slice(0, 100),
          is_active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) throw error;

      // Update preferences to enabled
      await updatePreferences({ ...preferences, enabled: true });

      setIsSubscribed(true);
      toast.success('Notificações ativadas! 🔔');
      return true;
    } catch {
      toast.error('Erro ao ativar notificações');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Unsubscribe from push notifications
  const unsubscribe = async () => {
    if (!user) return false;

    try {
      setLoading(true);

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      // Update preferences to disabled
      await updatePreferences({ ...preferences, enabled: false });

      setIsSubscribed(false);
      toast.success('Notificações desativadas');
      return true;
    } catch {
      toast.error('Erro ao desativar notificações');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update notification preferences
  const updatePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user) return false;

    try {
      const prefsAsJson: Json = {
        enabled: newPreferences.enabled,
        reminders: newPreferences.reminders,
        proactive_questions: newPreferences.proactive_questions,
        score_drops: newPreferences.score_drops,
        weekly_report: newPreferences.weekly_report,
        bills_due: newPreferences.bills_due,
      };

      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: prefsAsJson })
        .eq('id', user.id);

      if (error) throw error;

      setPreferences(newPreferences);
      return true;
    } catch {
      toast.error('Erro ao salvar preferências');
      return false;
    }
  };

  // Test notification
  const sendTestNotification = async () => {
    if (!isSubscribed) {
      toast.error('Ative as notificações primeiro');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user?.id,
          title: 'Teste de Notificação 🧪',
          body: 'Se você está vendo isso, as notificações estão funcionando!',
          type: 'test',
          url: '/'
        }
      });

      if (error) throw error;
      toast.success('Notificação de teste enviada!');
    } catch {
      toast.error('Erro ao enviar notificação de teste');
    }
  };

  return {
    permission,
    isSubscribed,
    loading,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    isSupported: 'serviceWorker' in navigator && 'PushManager' in window
  };
}
