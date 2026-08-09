'use client';
import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return <div className={clsx('space-y-2', className)}>{children}</div>;
}

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function AccordionItem({ children, className }: AccordionItemProps) {
  return <div className={clsx('border border-gray-200 rounded-lg', className)}>{children}</div>;
}

interface AccordionTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx('flex w-full items-center justify-between p-4 text-left font-medium hover:bg-gray-50 rounded-lg transition-colors', className)}
      >
        {children}
        <ChevronDown className={clsx('h-4 w-4 shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {(children as any)?.props?.children && isOpen && (
        <div className="px-4 pb-4 text-sm text-gray-600">
          {/* Content is rendered via AccordionContent */}
        </div>
      )}
    </div>
  );
}

interface AccordionContentProps {
  children: React.ReactNode;
  className?: string;
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  return <div className={clsx('px-4 pb-4 text-sm text-gray-600', className)}>{children}</div>;
}
