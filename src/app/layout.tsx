import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/layout/navigation';
import { TooltipProvider } from '@/components/ui/tooltip';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Lube Oil Procurement Optimizer',
  description: 'Maritime fleet lube oil procurement optimization dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} antialiased`}>
        <TooltipProvider>
          <div className="bg-dashboard min-h-screen">
            <Navigation />
            <main className="mx-auto max-w-7xl px-6 pt-24 pb-12">
              {children}
            </main>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
