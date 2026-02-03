import React, { useRef, useEffect, memo } from 'react';

const StarDust = memo(() => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // 150 particules pour un effet "Nebula" bien visible
    const dots = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 1, // Taille variée
      vx: (Math.random() - 0.5) * 0.4, // Vitesse X lente
      vy: (Math.random() - 0.5) * 0.4, // Vitesse Y lente
      o: Math.random() * 0.6 + 0.3     // Opacité boostée
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      dots.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;

        // Bouclage infini sur les bords
        if (d.x < 0) d.x = canvas.width;
        if (d.x > canvas.width) d.x = 0;
        if (d.y < 0) d.y = canvas.height;
        if (d.y > canvas.height) d.y = 0;

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        
        // Couleur NINJA (Violet #a020f0) avec effet de lueur
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#a020f0';
        ctx.fillStyle = `rgba(160, 32, 240, ${d.o})`;
        
        ctx.fill();
        ctx.shadowBlur = 0; // Reset pour la performance
      });
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none" 
      style={{ zIndex: 0, opacity: 0.8 }} 
    />
  );
});

StarDust.displayName = 'StarDust';
export default StarDust;
