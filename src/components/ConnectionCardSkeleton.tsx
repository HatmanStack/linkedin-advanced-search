import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";

/**
 * ConnectionCardSkeleton Component
 * 
 * Provides a skeleton loading state for connection cards while data is being fetched.
 * Matches the layout and dimensions of the actual ConnectionCard component.
 */

interface ConnectionCardSkeletonProps {
  className?: string;
}

const ConnectionCardSkeleton: React.FC<ConnectionCardSkeletonProps> = ({ 
  className = '' 
}) => {
  return (
    <div className={`p-4 rounded-lg border bg-white/5 border-white/10 ${className}`}>
      <div className="flex items-start space-x-4">
        {/* Profile Picture Skeleton */}
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        
        <div className="flex-1 min-w-0 space-y-3">
          {/* Name and Status Row */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-8" />
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
          
          {/* Activity Summary */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
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
 * ConnectionListSkeleton Component
 * 
 * Renders multiple connection card skeletons for list loading states
 */
interface ConnectionListSkeletonProps {
  count?: number;
  className?: string;
}

export const ConnectionListSkeleton: React.FC<ConnectionListSkeletonProps> = ({ 
  count = 5, 
  className = '' 
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }, (_, index) => (
        <ConnectionCardSkeleton key={index} />
      ))}
    </div>
  );
};

export default ConnectionCardSkeleton;