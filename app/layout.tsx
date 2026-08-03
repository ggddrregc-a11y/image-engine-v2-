import './globals.css';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AppShell } from '@/components/layout/app-shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const display = Sora({ subsets: ['latin'], variable: '--font-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'image Engine — AI Image Generation Platform',
  description:
    'Generate stunning images with state-of-the-art AI models. Crafted for creators.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${display.variable} ${mono.variable} font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
