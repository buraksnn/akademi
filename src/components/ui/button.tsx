import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ButtonHTMLAttributes } from 'react';
export const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));
export const buttonVariants = cva('button', {
  variants: {
    variant: { default: 'primary', outline: 'outline', ghost: 'ghost', destructive: 'destructive' },
    size: { default: '', sm: 'small', icon: 'icon-button' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
