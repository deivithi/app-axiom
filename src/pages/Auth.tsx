import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StarryBackground } from '@/components/ui/starry-background';
import axiomLogo from '@/assets/axiom-logo.png';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    signIn,
    signUp
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message,
        variant: 'destructive'
      });
    } else {
      navigate('/chat');
    }
    setLoading(false);
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const {
      error
    } = await signUp(email, password, fullName);
    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message.includes('already registered') ? 'Este email já está cadastrado' : error.message,
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
  return <div className="min-h-screen flex items-center justify-center p-4 relative bg-sidebar-border">
      <StarryBackground />
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4">
          <img src={axiomLogo} alt="Axiom Logo" className="w-32 h-auto mx-auto object-contain" />
          
          {/* Hero Headline */}
          <h1 className="text-lg font-bold leading-tight text-foreground">
            Converse com o Único Estrategista que Conecta Seu Dinheiro, Hábitos e Projetos em Tempo Real
          </h1>
          
          {/* Subheadline */}
          <p className="text-sm text-muted-foreground">
            Não preencha formulários. Não clique em menus. Apenas converse. 
            Axiom entende, executa e te questiona.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Começar Conversa</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar Conversa'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nome completo</Label>
                  <Input id="register-name" type="text" placeholder="Seu nome" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input id="register-email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Senha</Label>
                  <Input id="register-password" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Começar Conversa'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Pitch */}
      <p className="text-xs text-center text-muted-foreground mt-4 max-w-sm relative z-10">
        Axiom não é um app com chatbot. É um estrategista conversacional que gerencia sua vida enquanto você fala.
      </p>
    </div>;
}