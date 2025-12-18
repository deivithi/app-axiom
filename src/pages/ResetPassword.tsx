import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StarryBackground } from '@/components/ui/starry-background';
import { supabase } from '@/integrations/supabase/client';
import axiomLogo from '@/assets/axiom-logo.png';
import { emailSchema } from '@/lib/validations';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast({
        title: 'Erro',
        description: result.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    
    if (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o email. Tente novamente.',
        variant: 'destructive'
      });
    } else {
      setEmailSent(true);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <div className="gradient-orb orb-cyan" />
        <div className="gradient-orb orb-violet" />
        <StarryBackground />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8">
          <img 
            src={axiomLogo} 
            alt="Axiom Logo" 
            className="w-24 h-auto mx-auto mb-6" 
          />
          
          {!emailSent ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  Recuperar Senha
                </h2>
                <p className="text-muted-foreground mt-2">
                  Digite seu email para receber o link de recuperação
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Email</Label>
                  <div className="relative">
                    <input 
                      type="email"
                      className="input-premium pr-10"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      maxLength={255}
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <button type="submit" className="btn-gradient" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Link de Recuperação'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-success mx-auto" />
              <h2 className="text-2xl font-bold text-foreground">
                Email Enviado!
              </h2>
              <p className="text-muted-foreground">
                Verifique sua caixa de entrada (e spam) para o link de recuperação de senha.
              </p>
              <p className="text-sm text-muted-foreground">
                O link expira em 1 hora.
              </p>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link 
              to="/auth" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
