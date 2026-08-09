'use client';
import React, { useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50 h-full w-80 bg-white shadow-xl">
        {children}
        <button onClick={() => onOpenChange?.(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export function SheetTrigger({ children, onClick, asChild }: { children: React.ReactNode; onClick?: () => void; asChild?: boolean }) {
  if (asChild) return <span onClick={onClick} className="cursor-pointer">{children}</span>;
  return <span onClick={onClick} className="cursor-pointer">{children}</span>;
}

export function SheetContent({ className, children, side, ...props }: React.HTMLAttributes<HTMLDivElement> & { side?: string }) {
  return <div className={clsx('p-6 pt-12', className)} {...props}>{children}</div>;
}
