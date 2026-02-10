import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * LoadingOverlay Component
 *
 * Provides a loading overlay with spinner and optional message
 * Can be used as a full-screen overlay or within a specific container
 */

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'overlay' | 'inline';
  children?: React.ReactNode;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  className = '',
  size = 'md',
  variant = 'overlay',
  children,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const LoadingContent = () => (
    <div className="flex flex-col items-center justify-center space-y-4">
      <Loader2 className={cn('animate-spin text-blue-400', sizeClasses[size])} />
      {message && <p className="text-slate-300 text-sm font-medium">{message}</p>}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <LoadingContent />
      </div>
    );
  }

  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {children}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
        <LoadingContent />
      </div>
    </div>
  );
};

/**
 * InlineLoader Component
 *
 * Simple inline loading spinner for buttons and small components
 */
interface InlineLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({ size = 'sm', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />;
};

/**
 * LoadingButton Component
 *
 * Button with integrated loading state
 */
interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200',
        isLoading && 'cursor-not-allowed opacity-70',
        className
      )}
    >
      {isLoading && <InlineLoader size="sm" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
};

export default LoadingOverlay;
