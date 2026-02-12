'use client';

import { usePathname } from 'next/navigation';
import { Ship } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': 'Fleet Dashboard',
  '/vessels': 'Vessels',
  '/pricing': 'Pricing Matrix',
  '/plans': 'Purchase Plans',
  '/documentation': 'Documentation',
  '/settings': 'Settings',
  '/setup': 'Setup Wizard',
};

export function Header() {
  const pathname = usePathname();

  // Find matching title
  let title = 'Lube Oil Optimizer';
  for (const [path, t] of Object.entries(pageTitles)) {
    if (path === '/' ? pathname === '/' : pathname.startsWith(path)) {
      title = t;
      break;
    }
  }

  return (
    <header className="flex h-14 items-center border-b border-border px-6 bg-background/80 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Ship className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
    </header>
  );
}
