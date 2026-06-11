import React from 'react';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("w-full py-6 px-4 md:px-8 border-t border-border/40 bg-transparent print:hidden", className)}>
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            &copy; {currentYear} <span className="text-amber-600 dark:text-amber-500 font-semibold">Burhani Guards Khaitan</span>. All rights reserved.
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500 mt-1">
            BGK Attendance Tracking System &bull; Version 2.0.0
          </p>
        </div>
        <div className="flex flex-col md:items-end gap-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Designed and Managed by Shabbir Shakir
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-500">
            Dedicated to Khidmat under the guidance of Idara Admin
          </p>
        </div>
      </div>
    </footer>
  );
}
