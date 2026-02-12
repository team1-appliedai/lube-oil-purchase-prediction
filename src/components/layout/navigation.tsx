'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Ship,
  DollarSign,
  ClipboardList,
  Settings,
  Wrench,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vessels', label: 'Vessels', icon: Ship },
  { href: '/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/plans', label: 'Plans', icon: ClipboardList },
  { href: '/documentation', label: 'Docs', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/setup', label: 'Setup', icon: Wrench },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
      <div className="nav-container">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive ? 'nav-pill-active' : 'nav-pill'
              )}
            >
              <span className="flex items-center gap-1.5">
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
