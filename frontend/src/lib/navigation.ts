import { BarChart3, CalendarDays, Repeat, Sun, Target, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// The five primary areas: do the day, plan the week, set direction, build
// routines, and learn from the data.
export const NAV_ITEMS: NavItem[] = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/plan', label: 'Plan', icon: CalendarDays },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/habits', label: 'Habits', icon: Repeat },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
];

export const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
