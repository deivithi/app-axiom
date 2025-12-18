import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Download, 
  Share, 
  Plus, 
  Smartphone, 
  Zap, 
  Bell, 
  Wifi,
  Check,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { StarryBackground } from '@/components/ui/starry-background';
import axiomLogo from '@/assets/axiom-logo.png';

const benefits = [
  {
    icon: Zap,
    title: 'Acesso Instantâneo',
    description: 'Abra direto da sua tela inicial, sem navegador',
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Receba alertas importantes mesmo com o app fechado',
  },
  {
    icon: Wifi,
    title: 'Funciona Offline',
    description: 'Acesse suas informações mesmo sem internet',
  },
];

export default function Install() {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    promptInstall,
    isStandalone,
  } = usePWAInstall();

  // If already installed and running standalone, redirect
  useEffect(() => {
    if (isStandalone) {
      window.location.href = '/';
    }
  }, [isStandalone]);

  const handleInstall = async () => {
    if (!isIOS) {
      await promptInstall();
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <StarryBackground />
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 flex justify-center">
          <img 
            src={axiomLogo} 
            alt="Axiom" 
            className="h-12 w-auto"
          />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md text-center"
          >
            {/* App Icon Preview */}
            <div className="mb-8">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary via-purple-600 to-cyan-500 p-0.5 shadow-2xl shadow-primary/20"
              >
                <div className="w-full h-full rounded-3xl bg-card flex items-center justify-center">
                  <img 
                    src={axiomLogo} 
                    alt="Axiom" 
                    className="w-16 h-16 object-contain"
                  />
                </div>
              </motion.div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Instalar Axiom
            </h1>
            <p className="text-muted-foreground mb-8">
              Seu estrategista pessoal sempre à mão
            </p>

            {/* Already Installed */}
            {isInstalled && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="flex items-center justify-center gap-2 text-emerald-500">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Axiom já está instalado!</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Procure o ícone na sua tela inicial
                </p>
              </motion.div>
            )}

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Install Instructions */}
            {!isInstalled && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {isIOS ? (
                  /* iOS Instructions */
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {isSafari 
                        ? 'Siga os passos abaixo para instalar:'
                        : 'Abra este site no Safari para instalar'}
                    </p>
                    
                    {isSafari && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                            1
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-foreground flex items-center gap-2">
                              Toque em <Share className="w-4 h-4" /> Compartilhar
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                            2
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-foreground flex items-center gap-2">
                              Selecione <Plus className="w-4 h-4" /> Adicionar à Tela de Início
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                            3
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-foreground">
                              Toque em "Adicionar"
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Android/Desktop Install Button */
                  <div className="space-y-4">
                    {isInstallable ? (
                      <Button
                        size="lg"
                        onClick={handleInstall}
                        className="w-full gap-2 h-14 text-lg"
                      >
                        <Download className="w-5 h-5" />
                        Instalar Axiom
                      </Button>
                    ) : (
                      <div className="p-4 rounded-xl bg-muted/50 text-center">
                        <p className="text-sm text-muted-foreground">
                          {isChrome 
                            ? 'O prompt de instalação aparecerá automaticamente ou use o menu do navegador (⋮ → Instalar app)'
                            : 'Abra no Chrome ou Edge para instalar como aplicativo'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Continue to App */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8"
            >
              <a
                href="/"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Continuar no navegador
                <ChevronRight className="w-4 h-4" />
              </a>
            </motion.div>
          </motion.div>
        </main>

        {/* Device Info Footer */}
        <footer className="p-4 text-center text-xs text-muted-foreground">
          {isIOS && 'iOS'}
          {isAndroid && 'Android'}
          {!isIOS && !isAndroid && 'Desktop'}
          {' • '}
          {isSafari && 'Safari'}
          {isChrome && 'Chrome'}
          {!isSafari && !isChrome && 'Navegador'}
        </footer>
      </div>
    </div>
  );
}
