import React from 'react';
import { clsx } from 'clsx';

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

export function Checkbox({ className, onCheckedChange, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={clsx('h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/50', className)}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}
