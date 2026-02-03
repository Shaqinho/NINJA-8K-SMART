import React, { useRef, useEffect, memo } from 'react';
import { THEME } from '../constants/theme';

// ============================================================================
// PARTICLE THEMES - Ultimate V2 (Nebula + StarDust + Ember) & Soft (Nebula + StarDust)
// 
// FIX: Uses window dimensions as fallback when containerRef is not provided
// or when container has no dimensions (fixed positioning edge case)
// ============================================================================

const COLORS = THEME.particles?.colors || ['#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#F97316', '#FACC15', '#4ADE80', '#2DD4BF', '#06B6D4', '#3B82F6', '#6366F1'];
const EMBER_COLORS = ['#F97316', '#FACC15', '#EF4444', '#F59E0B', '#FCD34D', '#FB923C'];

// Convert hex to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 139, g: 92, b: 246 };
};

// Interpolate between two colors
const lerpColor = (color1, color2, t) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
};

// Get rainbow color based on phase (0-1)
const getRainbowColor = (phase) => {
  const index = phase * COLORS.length;
  const i = Math.floor(index) % COLORS.length;
  const next = (i + 1) % COLORS.length;
  const t = index - Math.floor(index);
  return lerpColor(COLORS[i], COLORS[next], t);
};

// ============================================================================
// GET CANVAS DIMENSIONS - Uses containerRef or falls back to window
// ============================================================================
const getCanvasDimensions = (containerRef) => {
  // Try containerRef first
  if (containerRef?.current) {
    const rect = containerRef.current.getBoundingClientRect();
    // Only use if dimensions are valid (not 0)
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
  }
  
  // Fallback to window dimensions
  return { 
    width: window.innerWidth, 
    height: window.innerHeight 
  };
};

// ============================================================================
// ULTIMATE V2 THEME - Nebula + StarDust + Ultra Subtle Ember
// ============================================================================
const UltimateTheme = memo(({ containerRef }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const cloudsRef = useRef([]);
  const particlesRef = useRef([]);
  const embersRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      const { width, height } = getCanvasDimensions(containerRef);
      canvas.width = width;
      canvas.height = height;
      if (cloudsRef.current.length === 0) initParticles();
    };

    const initParticles = () => {
      const { width, height } = getCanvasDimensions(containerRef);
      
      // Nebula clouds
      cloudsRef.current = Array.from({ length: 4 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 120 + 80,
        speedX: (Math.random() - 0.5) * 0.12,
        speedY: (Math.random() - 0.5) * 0.08,
        colorPhase: Math.random(),
        colorSpeed: Math.random() * 0.0008 + 0.0003,
      }));

      // StarDust particles (slow)
      particlesRef.current = Array.from({ length: 40 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.5 + 0.2,
        speedX: (Math.random() - 0.5) * 0.03,
        speedY: (Math.random() - 0.5) * 0.02 + 0.008,
        colorPhase: Math.random(),
        colorSpeed: Math.random() * 0.0015 + 0.0005,
        opacity: Math.random() * 0.25 + 0.08,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.003 + 0.001,
      }));

      // Initial embers
      embersRef.current = Array.from({ length: 15 }, () => {
        const e = createEmber(width, height);
        e.y = Math.random() * height;
        e.life = Math.random();
        return e;
      });
    };

    const createEmber = (width, height) => ({
      x: Math.random() * width,
      y: height + 10,
      size: Math.random() * 0.8 + 0.4,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: -(Math.random() * 0.4 + 0.15),
      life: 1,
      decay: Math.random() * 0.003 + 0.001,
      color: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.02 + 0.01,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.03 + 0.01,
    });

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // --- LAYER 1: Nebula Fog ---
      cloudsRef.current.forEach(c => {
        c.x += c.speedX;
        c.y += c.speedY;
        c.colorPhase += c.colorSpeed;
        if (c.colorPhase > 1) c.colorPhase -= 1;

        if (c.x < -c.radius) c.x = width + c.radius;
        if (c.x > width + c.radius) c.x = -c.radius;
        if (c.y < -c.radius) c.y = height + c.radius;
        if (c.y > height + c.radius) c.y = -c.radius;

        const color = getRainbowColor(c.colorPhase);
        const gradient = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.07)`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.025)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // --- LAYER 2: Ember (ultra subtle) ---
      if (embersRef.current.length < 20 && Math.random() < 0.03) {
        embersRef.current.push(createEmber(width, height));
      }

      for (let i = embersRef.current.length - 1; i >= 0; i--) {
        const e = embersRef.current[i];

        e.wobble += e.wobbleSpeed;
        e.pulse += e.pulseSpeed;
        e.x += e.speedX + Math.sin(e.wobble) * 0.15;
        e.y += e.speedY;
        e.life -= e.decay;

        if (e.life <= 0 || e.y < -10) {
          embersRef.current.splice(i, 1);
          continue;
        }

        const color = hexToRgb(e.color);
        const pulseMultiplier = 0.6 + 0.4 * Math.sin(e.pulse);
        const opacity = e.life * 0.11 * pulseMultiplier;

        const glowSize = e.size * 6;
        const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowSize);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.6})`);
        gradient.addColorStop(0.2, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.3})`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.1})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(e.x, e.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.fill();
      }

      // --- LAYER 3: StarDust (slow) ---
      particlesRef.current.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.colorPhase += p.colorSpeed;
        if (p.colorPhase > 1) p.colorPhase -= 1;
        p.pulse += p.pulseSpeed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const color = getRainbowColor(p.colorPhase);
        const currentOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));

        const glowSize = p.size * 2.5;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentOpacity})`);
        gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentOpacity * 0.4})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 0.8})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

UltimateTheme.displayName = 'UltimateTheme';

// ============================================================================
// SOFT THEME - Nebula + StarDust only (no ember)
// ============================================================================
const SoftTheme = memo(({ containerRef }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const cloudsRef = useRef([]);
  const particlesRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      const { width, height } = getCanvasDimensions(containerRef);
      canvas.width = width;
      canvas.height = height;
      if (cloudsRef.current.length === 0) initParticles();
    };

    const initParticles = () => {
      const { width, height } = getCanvasDimensions(containerRef);
      
      // Nebula clouds
      cloudsRef.current = Array.from({ length: 4 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 100 + 70,
        speedX: (Math.random() - 0.5) * 0.1,
        speedY: (Math.random() - 0.5) * 0.08,
        colorPhase: Math.random(),
        colorSpeed: Math.random() * 0.0008 + 0.0003,
      }));

      // StarDust particles
      particlesRef.current = Array.from({ length: 45 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 0.5 + 0.2,
        speedX: (Math.random() - 0.5) * 0.03,
        speedY: (Math.random() - 0.5) * 0.02 + 0.008,
        colorPhase: Math.random(),
        colorSpeed: Math.random() * 0.0015 + 0.0005,
        opacity: Math.random() * 0.28 + 0.1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.003 + 0.001,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // --- Nebula Fog ---
      cloudsRef.current.forEach(c => {
        c.x += c.speedX;
        c.y += c.speedY;
        c.colorPhase += c.colorSpeed;
        if (c.colorPhase > 1) c.colorPhase -= 1;

        if (c.x < -c.radius) c.x = width + c.radius;
        if (c.x > width + c.radius) c.x = -c.radius;
        if (c.y < -c.radius) c.y = height + c.radius;
        if (c.y > height + c.radius) c.y = -c.radius;

        const color = getRainbowColor(c.colorPhase);
        const gradient = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.07)`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.025)`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // --- StarDust ---
      particlesRef.current.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.colorPhase += p.colorSpeed;
        if (p.colorPhase > 1) p.colorPhase -= 1;
        p.pulse += p.pulseSpeed;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const color = getRainbowColor(p.colorPhase);
        const currentOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));

        const glowSize = p.size * 2.5;
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentOpacity})`);
        gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${currentOpacity * 0.4})`);
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity * 0.8})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
});

SoftTheme.displayName = 'SoftTheme';

// ============================================================================
// PARTICLE THEMES - Main export with theme switching
// ============================================================================
const ParticleThemes = memo(({ containerRef, theme = 'ultimate' }) => {
  if (theme === 'soft') {
    return <SoftTheme containerRef={containerRef} />;
  }
  return <UltimateTheme containerRef={containerRef} />;
});

ParticleThemes.displayName = 'ParticleThemes';

export { ParticleThemes, UltimateTheme, SoftTheme };
export default ParticleThemes;
