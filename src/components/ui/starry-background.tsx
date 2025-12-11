import { ShootingStars } from "./shooting-stars";

export const StarryBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Gradiente radial central com tom violet */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08)_0%,transparent_70%)]" />
      
      {/* Estrelas estáticas com twinkle */}
      <div className="stars absolute inset-0" />
      
      {/* Camadas de shooting stars com cores cyan/teal do tema */}
      <ShootingStars
        starColor="#14B8A6"
        trailColor="#5EEAD4"
        minSpeed={15}
        maxSpeed={30}
        minDelay={2000}
        maxDelay={5000}
      />
      <ShootingStars
        starColor="#06B6D4"
        trailColor="#67E8F9"
        minSpeed={10}
        maxSpeed={25}
        minDelay={3000}
        maxDelay={6000}
      />
    </div>
  );
};
