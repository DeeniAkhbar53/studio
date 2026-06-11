"use client";

import { cn } from "@/lib/utils";

interface FunkyLoaderProps {
  className?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'default' | 'lg';
}

export const FunkyLoader = ({ className, children, size = 'default' }: FunkyLoaderProps) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    default: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={cn("bouncing-loader", className)}>
        <div className={cn(size === 'sm' ? "w-2 h-2" : size === 'lg' ? "w-5 h-5" : "w-3 h-3" , "bounce1")}></div>
        <div className={cn(size === 'sm' ? "w-2 h-2" : size === 'lg' ? "w-5 h-5" : "w-3 h-3" , "bounce2")}></div>
        <div className={cn(size === 'sm' ? "w-2 h-2" : size === 'lg' ? "w-5 h-5" : "w-3 h-3" , "bounce3")}></div>
      </div>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  );
};
