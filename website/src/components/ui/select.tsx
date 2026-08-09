'use client';
import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            selectValue: value,
            onSelectChange: (v: string) => { onValueChange?.(v); setIsOpen(false); },
            isOpen,
            onToggle: () => setIsOpen(!isOpen),
          });
        }
        return child;
      })}
    </div>
  );
}

export function SelectTrigger({ className, children, selectValue, isOpen, onToggle, ...props }: any) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx('flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50', className)}
      {...props}
    >
      {children}
      <ChevronDown className={clsx('h-4 w-4 opacity-50 transition-transform', isOpen && 'rotate-180')} />
    </button>
  );
}

export function SelectContent({ children, isOpen, ...props }: any) {
  if (!isOpen) return null;
  return (
    <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg" {...props}>
      {children}
    </div>
  );
}

export function SelectItem({ children, value, onSelectChange, ...props }: any) {
  return (
    <div
      className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 rounded-lg mx-1 my-0.5"
      onClick={() => onSelectChange?.(value)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SelectValue({ placeholder, selectValue }: { placeholder?: string; selectValue?: string }) {
  return <span className={clsx(!selectValue && 'text-gray-400')}>{selectValue || placeholder}</span>;
}
