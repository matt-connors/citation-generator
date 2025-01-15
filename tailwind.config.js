/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,tsx,ts,astro}"],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                'background-1': "var(--background-1)",
                'background-2': "var(--background-2)",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "hsl(var(--primary-foreground))",
                },
                focus: {
                    DEFAULT: "var(--focus)",
                    foreground: "var(--focus-foreground)",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                'slide-right': {
                    from: { transform: 'translateX(-10%)' },
                    to: { transform: 'translateX(0)' },
                },
                'fade': {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                'slide-right': 'slide-right 0.2s ease-out',
                'fade': 'fade 0.2s ease-out',
                'spin-slow': 'spin 1.5s linear infinite',
            },
            fontWeight: {
                normal: 440,
                medium: 490,
            },
            fontSize: {
                "base": "15px"
            },
        },
    },
}

