import React from 'react';
import { clsx } from 'clsx';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function Breadcrumb({ className, ...props }: BreadcrumbProps) {
  return <nav className={clsx('flex items-center space-x-1 text-sm text-gray-500', className)} {...props} />;
}

interface BreadcrumbItemProps extends React.HTMLAttributes<HTMLLIElement> {
  children: React.ReactNode;
}

export function BreadcrumbItem({ className, ...props }: BreadcrumbItemProps) {
  return <li className={clsx('flex items-center', className)} {...props} />;
}

export function BreadcrumbSeparator({ className, ...props }: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={clsx('flex items-center', className)} {...props}><ChevronRight className="h-3 w-3" /></li>;
}

export function BreadcrumbLink({ className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={clsx('hover:text-brand transition-colors', className)} {...props} />;
}

export function BreadcrumbPage({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={clsx('font-medium text-gray-900', className)} {...props} />;
}

export function BreadcrumbList({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={clsx('flex flex-wrap items-center gap-1.5 break-words text-sm', className)} {...props} />;
}
