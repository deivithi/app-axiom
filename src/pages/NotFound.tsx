import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { StarryBackground } from "@/components/ui/starry-background";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.warn("[404] Rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <StarryBackground />
      <div className="text-center relative z-10">
        <h1 className="mb-2 text-7xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          404
        </h1>
        <p className="mb-6 text-xl text-muted-foreground">
          Página não encontrada
        </p>
        <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
          <Home className="h-4 w-4" />
          Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
