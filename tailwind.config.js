// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        'ninja-black': '#000000',
        'ninja-purple': '#6225ff',
        'ninja-magenta': '#a020f0',
        'ninja-dark': '#0a0a0a',
      },
      backgroundImage: {
        'ninja-gradient': 'linear-gradient(90deg, #6225ff 0%, #a020f0 100%)',
        'ninja-glass': 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #6225ff' },
          '100%': { boxShadow: '0 0 20px #a020f0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      dropShadow: {
        'ninja': '0 0 8px rgba(98, 37, 255, 0.5)',
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide'),
  ],
};
