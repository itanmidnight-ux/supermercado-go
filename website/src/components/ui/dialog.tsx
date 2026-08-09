'use client';
import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [isOpen, setIsOpen] = useState(open || false);
  useEffect(() => { if (open !== undefined) setIsOpen(open); }, [open]);
  const handleClose = () => { setIsOpen(false); onOpenChange?.(false); };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-50 bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        {children}
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export function DialogTrigger({ children, onClick, asChild }: { children: React.ReactNode; onClick?: () => void; asChild?: boolean }) {
  return <span onClick={onClick} className="cursor-pointer">{children}</span>;
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('mt-2', className)} {...props}>{children}</div>;
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={clsx('text-lg font-semibold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={clsx('text-sm text-gray-500', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('mt-4 flex justify-end gap-2', className)} {...props} />;
}
