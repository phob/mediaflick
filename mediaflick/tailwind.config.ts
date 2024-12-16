// tailwind.config.ts
import { nextui } from "@nextui-org/react";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          // Chartreuse color scale
          50: '#f7ffe0',
          100: '#eeffb3',
          200: '#e2ff80',
          300: '#d4ff4d',
          400: '#ccff00', // Your requested color
          500: '#a3cc00',
          600: '#7a9900',
          700: '#526600',
          800: '#293300',
          900: '#141a00',
          DEFAULT: '#ccff00',
        }
      }
    },
  },
  darkMode: "class",
  plugins: [
    nextui({
      themes: {
        light: {
          colors: {
            background: "#fcfcfc",
            primary: {
              DEFAULT: "#ccff00",
              foreground: "#000000", // Changed to black for better contrast
            },
          },
        },
        dark: {
          colors: {
            background: "#151515",
            primary: {
              DEFAULT: "#ccff00",
              foreground: "#000000", // Changed to black for better contrast
            },
          },
        },
      },
    }),
  ],
};