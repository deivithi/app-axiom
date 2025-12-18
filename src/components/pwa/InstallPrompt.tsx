import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share, Plus, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface InstallPromptProps {
  delay?: number; // Delay in ms before showing
}

export function InstallPrompt({ delay = 30000 }: InstallPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isSafari,
    promptInstall,
    dismissPrompt,
    hasUserDismissed,
  } = usePWAInstall();

  useEffect(() => {
    // Don't show if already installed, dismissed, or not installable
    if (isInstalled || hasUserDismissed || !isInstallable) {
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, isInstalled, hasUserDismissed, isInstallable]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else {
      const success = await promptInstall();
      if (success) {
        setIsVisible(false);
      }
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismissPrompt();
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Banner */}
      <AnimatePresence>
        {isVisible && !showIOSModal && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
          >
            <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    Instale o Axiom
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isIOS 
                      ? 'Adicione à sua tela inicial para acesso rápido'
                      : 'Tenha acesso rápido direto da sua tela inicial'}
                  </p>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={handleInstall}
                      className="gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Instalar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleDismiss}
                    >
                      Agora não
                    </Button>
                  </div>
                </div>

                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Instructions Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center mb-4">
                  <Smartphone className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  Instalar no {isSafari ? 'Safari' : 'iOS'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Siga os passos abaixo para instalar
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Share className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">1. Toque em Compartilhar</p>
                    <p className="text-xs text-muted-foreground">
                      Ícone na barra inferior do Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">2. Adicionar à Tela de Início</p>
                    <p className="text-xs text-muted-foreground">
                      Role para baixo e toque na opção
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Download className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">3. Confirme a instalação</p>
                    <p className="text-xs text-muted-foreground">
                      Toque em "Adicionar" no canto superior
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full mt-6"
                onClick={() => setShowIOSModal(false)}
              >
                Entendi
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
