import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, Lock, Check, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StarryBackground } from '@/components/ui/starry-background';
import { supabase } from '@/integrations/supabase/client';
import axiomLogo from '@/assets/axiom-logo.png';
import { passwordSchema, getPasswordStrength } from '@/lib/validations';
import { cn } from '@/lib/utils';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordStrength = getPasswordStrength(password);
  
  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Uma letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Um número', met: /[0-9]/.test(password) },
    { label: 'Um caractere especial', met: /[^A-Za-z0-9]/.test(password) },
  ];

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // The user should have been redirected here with a valid session from the recovery link
      if (session) {
        setValidSession(true);
      } else {
        toast({
          title: 'Link inválido ou expirado',
          description: 'Solicite um novo link de recuperação de senha.',
          variant: 'destructive'
        });
      }
      setCheckingSession(false);
    };
    
    checkSession();
  }, [toast]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      toast({
        title: 'Senha fraca',
        description: result.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }
    
    if (password !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'As senhas digitadas são diferentes.',
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({ password });
    
    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Senha atualizada!',
        description: 'Sua senha foi alterada com sucesso.'
      });
      navigate('/intelligence');
    }
    
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative">
        <StarryBackground />
        <Loader2 className="h-8 w-8 animate-spin text-primary relative z-10" />
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-background">
        <div className="absolute inset-0 z-0">
          <StarryBackground />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 text-center">
            <img src={axiomLogo} alt="Axiom Logo" className="w-24 h-auto mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-4">Link Expirado</h2>
            <p className="text-muted-foreground mb-6">
              O link de recuperação de senha expirou ou é inválido.
            </p>
            <a href="/reset-password" className="btn-gradient inline-flex">
              Solicitar novo link
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <div className="gradient-orb orb-cyan" />
        <div className="gradient-orb orb-violet" />
        <StarryBackground />
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8">
          <img src={axiomLogo} alt="Axiom Logo" className="w-24 h-auto mx-auto mb-6" />
          
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Nova Senha
            </h2>
            <p className="text-muted-foreground mt-2">
              Crie uma nova senha forte para sua conta
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Nova Senha</Label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  className="input-premium pr-10"
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  maxLength={128}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              
              {password && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-300",
                          passwordStrength.score <= 2 && "bg-destructive w-1/3",
                          passwordStrength.score > 2 && passwordStrength.score <= 4 && "bg-warning w-2/3",
                          passwordStrength.score > 4 && "bg-success w-full"
                        )}
                      />
                    </div>
                    <span className={cn(
                      "text-xs font-medium",
                      passwordStrength.score <= 2 && "text-destructive",
                      passwordStrength.score > 2 && passwordStrength.score <= 4 && "text-warning",
                      passwordStrength.score > 4 && "text-success"
                    )}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1">
                    {passwordRequirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {req.met ? (
                          <Check className="h-3 w-3 text-success" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className={req.met ? "text-success" : "text-muted-foreground"}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Confirmar Senha</Label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  className="input-premium pr-10"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  maxLength={128}
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
              )}
            </div>

            <button type="submit" className="btn-gradient" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Atualizar Senha'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
