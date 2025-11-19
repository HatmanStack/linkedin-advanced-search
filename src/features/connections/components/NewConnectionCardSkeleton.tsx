import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

/**
 * NewConnectionCardSkeleton Component
 * 
 * Provides a skeleton loading state for new connection cards while data is being fetched.
 * Matches the layout and dimensions of the actual NewConnectionCard component.
 */

interface NewConnectionCardSkeletonProps {
  className?: string;
}

const NewConnectionCardSkeleton: React.FC<NewConnectionCardSkeletonProps> = ({ 
  className = '' 
}) => {
  return (
    <div className={`p-4 rounded-lg border bg-white/5 border-white/10 ${className}`}>
      <div className="flex items-start space-x-4">
        {/* Profile Picture Skeleton */}
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        
        <div className="flex-1 min-w-0 space-y-3">
          {/* Name and Remove Button Row */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
          
          {/* Position and Company */}
          <div className="flex items-center space-x-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
          
          {/* Location */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-3 w-28" />
          </div>
          
          {/* Headline */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          
          {/* Conversion Likelihood */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          
          {/* Tags */}
          <div className="flex items-center space-x-2">
            <Skeleton className="h-3 w-3" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          
          {/* Date Added */}
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
};

/**
 * NewConnectionListSkeleton Component
 * 
 * Renders multiple new connection card skeletons for list loading states
 */
interface NewConnectionListSkeletonProps {
  count?: number;
  className?: string;
}

export const NewConnectionListSkeleton: React.FC<NewConnectionListSkeletonProps> = ({ 
  count = 3, 
  className = '' 
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <NewConnectionCardSkeleton key={index} />
      ))}
    </div>
  );
};

export default NewConnectionCardSkeleton;