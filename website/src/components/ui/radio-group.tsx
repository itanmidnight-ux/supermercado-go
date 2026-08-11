import React from 'react';
import { clsx } from 'clsx';

interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({ className, value, onValueChange, children, ...props }: RadioGroupProps) {
  return (
    <div role="radiogroup" className={clsx('grid gap-2', className)} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === RadioGroupItem) {
          return React.cloneElement(child as React.ReactElement<any>, { groupName: 'radio-group', groupValue: value, onGroupChange: onValueChange });
        }
        return child;
      })}
    </div>
  );
}

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  groupName?: string;
  groupValue?: string;
  onGroupChange?: (value: string) => void;
}

export function RadioGroupItem({ className, groupName, groupValue, onGroupChange, value, ...props }: RadioGroupItemProps) {
  return (
    <input
      type="radio"
      name={groupName}
      checked={groupValue === value}
      onChange={() => onGroupChange?.(String(value || ''))}
      className={clsx('h-4 w-4 border-gray-300 text-brand focus:ring-brand/50', className)}
      {...props}
    />
  );
}
