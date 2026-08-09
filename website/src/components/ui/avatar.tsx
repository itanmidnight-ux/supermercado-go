import React from 'react';
import { clsx } from 'clsx';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
}

export function Avatar({ className, src, alt, ...props }: AvatarProps) {
  return (
    <div className={clsx('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)} {...props}>
      {src ? <img src={src} alt={alt || ''} className="aspect-square h-full w-full" /> : null}
    </div>
  );
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {}

export function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  return <div className={clsx('flex h-full w-full items-center justify-center rounded-full bg-brand/10 text-brand font-medium', className)} {...props} />;
}
