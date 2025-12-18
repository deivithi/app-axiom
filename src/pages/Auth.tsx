import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Eye, EyeOff, ArrowRight, User, Check, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StarryBackground } from '@/components/ui/starry-background';
import axiomLogo from '@/assets/axiom-logo.png';
import { signUpSchema, signInSchema, getPasswordStrength } from '@/lib/validations';
import { cn } from '@/lib/utils';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordStrength = getPasswordStrength(password);
  
  // Password requirements check
  const passwordRequirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Uma letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Uma letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Um número', met: /[0-9]/.test(password) },
    { label: 'Um caractere especial', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setValidationErrors(result.error.errors.map(err => err.message));
      return;
    }
    
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
        variant: 'destructive'
      });
    } else {
      navigate('/chat');
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);
    
    const result = signUpSchema.safeParse({ email, password, fullName });
    if (!result.success) {
      setValidationErrors(result.error.errors.map(err => err.message));
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message.includes('already registered') 
          ? 'Este email já está cadastrado' 
          : error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Bem-vindo ao Axiom'
      });
      navigate('/chat');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Background: Gradient Orbs + Stars */}
      <div className="absolute inset-0 z-0">
        <div className="gradient-orb orb-cyan" />
        <div className="gradient-orb orb-violet" />
        <div className="gradient-orb orb-blue" />
        <StarryBackground />
      </div>

      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Content Grid */}
      <div className="relative z-10 min-h-screen grid lg:grid-cols-2 gap-8 p-4 lg:p-8">
        
        {/* Left: Branding (hidden on mobile) */}
        <div className="hidden lg:flex flex-col justify-center items-start p-8 lg:p-12">
          <img 
            src={axiomLogo} 
            alt="Axiom Logo" 
            className="w-44 h-auto mb-8 drop-shadow-2xl" 
          />
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 text-foreground">
            O Estrategista que{' '}
            <span className="gradient-text">Conecta Sua Vida</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Dinheiro. Hábitos. Projetos. Tudo em uma conversa.
          </p>
          
          {/* Score Visualization Placeholder */}
          <div className="mt-8 w-full max-w-sm">
            <div className="aspect-square rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 
                          flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-primary/30 to-transparent 
                            animate-pulse" />
              <div className="relative z-10 text-center">
                <span className="text-6xl font-bold gradient-text">847</span>
                <p className="text-sm text-muted-foreground mt-2">Axiom Score</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Form Glassmorphism */}
        <div className="flex items-center justify-center">
          <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8">
            {/* Mobile Logo */}
            <img 
              src={axiomLogo} 
              alt="Axiom Logo" 
              className="lg:hidden w-24 h-auto mx-auto mb-6" 
            />
            
            {/* Header */}
            <div className="text-center lg:text-left mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Bem-vindo de volta
              </h2>
              <p className="text-muted-foreground mt-2">
                Entre para continuar sua jornada
              </p>
            </div>

            {/* Form with Tabs */}
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar Conta</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  {/* Email Input */}
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

                  {/* Password Input */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Senha</Label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="input-premium pr-10"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        maxLength={128}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground 
                                   hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="text-sm text-destructive space-y-1">
                      {validationErrors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  {/* Forgot Password */}
                  <a href="#" className="inline-block text-sm text-muted-foreground hover:text-primary transition-colors">
                    Esqueceu sua senha?
                  </a>

                  {/* Submit Button */}
                  <button type="submit" className="btn-gradient" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="divider-text">
                  <span>ou</span>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" className="btn-social">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" className="btn-social">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Apple
                  </button>
                </div>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Name Input */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Nome completo</Label>
                    <div className="relative">
                      <input 
                        type="text"
                        className="input-premium pr-10"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        required
                        maxLength={100}
                      />
                      <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Email Input */}
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

                  {/* Password Input */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Senha</Label>
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground 
                                   hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
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
                        
                        {/* Password Requirements */}
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

                  {/* Validation Errors */}
                  {validationErrors.length > 0 && (
                    <div className="text-sm text-destructive space-y-1">
                      {validationErrors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button type="submit" className="btn-gradient" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Criando conta...
                      </>
                    ) : (
                      <>
                        Começar Jornada
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="divider-text">
                  <span>ou</span>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" className="btn-social">
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </button>
                  <button type="button" className="btn-social">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Apple
                  </button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Footer */}
            <p className="text-xs text-center text-muted-foreground mt-6">
              Axiom não é um app com chatbot. É um estrategista conversacional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
