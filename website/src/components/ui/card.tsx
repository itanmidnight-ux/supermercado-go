import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
export function Card({ className, ...props }: CardProps) {
  return <div className={clsx('rounded-xl border border-gray-200 bg-white shadow-sm', className)} {...props} />;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export function CardContent({ className, ...props }: CardContentProps) {
  return <div className={clsx('p-4', className)} {...props} />;
}
