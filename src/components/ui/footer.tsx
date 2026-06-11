import React from 'react';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("w-full py-4 px-4 md:px-8 border-t border-border/40 bg-transparent print:hidden", className)}>
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4 text-center md:text-left">
        <div>
          <p className="text-[11px] md:text-xs font-medium text-slate-600 dark:text-slate-400">
            &copy; {currentYear} <span className="text-amber-600 dark:text-amber-500 font-semibold">Burhani Guards Khaitan</span>. All rights reserved.
          </p>
          <p className="text-[10px] md:text-[11px] text-slate-500 dark:text-slate-500 mt-0.5">
            BGK Attendance Tracking System &bull; Version 2.0.0
          </p>
        </div>
        <div className="flex flex-row md:flex-col items-center justify-center md:items-end gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-500 mt-1 md:mt-0 border-t border-slate-200 dark:border-slate-800/40 md:border-t-0 pt-1.5 md:pt-0">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Managed by Shabbir Shakir
          </p>
          <span className="md:hidden text-slate-400">&bull;</span>
          <p>
            Idara Admin
          </p>
        </div>
      </div>
    </footer>
  );
}
