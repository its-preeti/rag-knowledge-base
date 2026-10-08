import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

export function getFileIcon(fileType: string): string {
  const icons: Record<string, string> = {
    pdf: '📄',
    docx: '📝',
    doc: '📝',
    txt: '📃',
    csv: '📊',
    json: '⚙️',
    md: '📋',
    markdown: '📋',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    webp: '🖼️',
    zip: '🗜️',
  };
  return icons[fileType?.toLowerCase()] || '📄';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    COMPLETED: 'text-green-500',
    PROCESSING: 'text-blue-500',
    PENDING: 'text-yellow-500',
    FAILED: 'text-red-500',
  };
  return colors[status] || 'text-gray-500';
}

export function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
    PROCESSING: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    PENDING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    FAILED: 'bg-red-500/10 text-red-500 border-red-500/20',
  };
  return classes[status] || 'bg-gray-500/10 text-gray-500';
}

export function estimateCost(tokens: number, model: string = 'gpt-4o'): number {
  const pricing: Record<string, number> = {
    'gpt-4o': 0.005,
    'gpt-4': 0.03,
    'gpt-3.5-turbo': 0.002,
  };
  const rate = pricing[model] || 0.005;
  return (tokens / 1000) * rate;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}