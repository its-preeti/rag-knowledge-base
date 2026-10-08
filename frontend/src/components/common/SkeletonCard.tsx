import { cn } from '@/utils/helpers';

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg bg-muted animate-pulse', className || 'h-16')} />
  );
}