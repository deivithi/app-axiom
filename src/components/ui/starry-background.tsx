import { ShootingStars } from "./shooting-stars";

export const StarryBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradiente radial central com tom violet */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08)_0%,transparent_70%)]" />
      
      {/* Estrelas estáticas com twinkle */}
      <div className="stars absolute inset-0" />
      
      {/* Camadas de shooting stars com cores do tema Axiom */}
      <ShootingStars
        starColor="#8B5CF6"
        trailColor="#A78BFA"
        minSpeed={15}
        maxSpeed={30}
        minDelay={2000}
        maxDelay={5000}
      />
      <ShootingStars
        starColor="#6366F1"
        trailColor="#818CF8"
        minSpeed={10}
        maxSpeed={25}
        minDelay={3000}
        maxDelay={6000}
      />
    </div>
  );
};
