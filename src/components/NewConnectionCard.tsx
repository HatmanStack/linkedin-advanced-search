import React, { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Building, MapPin, Tag, X, Loader2, CheckCircle, UserPlus } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { lambdaApiService as dbConnector } from "@/services/lambdaApiService";
import { puppeteerApiService } from "@/services/puppeteerApiService";
import { transformErrorForUser, getToastVariant, ERROR_MESSAGES } from "@/utils/errorHandling";
import type { Connection, NewConnectionCardProps } from '@/types';

/**
 * NewConnectionCard Component
 * 
 * Simplified card component for displaying 'possible' status connections.
 * Excludes message-related information and includes conversion likelihood
 * percentage display with remove functionality.
 * 
 * @param props - The component props
 * @param props.connection - Connection data to display (must have status 'possible')
 * @param props.onRemove - Callback when remove button is clicked
 * @param props.onSelect - Callback when card is selected
 * @param props.className - Additional CSS classes
 * 
 * @returns JSX element representing the new connection card
 */
const NewConnectionCard: React.FC<NewConnectionCardProps> = ({
  connection,
  onRemove,
  onSelect
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [skipRemoveConfirm, setSkipRemoveConfirm] = useState(false);
  const { toast } = useToast();

  // Preference storage key
  const REMOVE_CONFIRM_PREF_KEY = 'hideRemoveConfirm';

  useEffect(() => {
    try {
      const pref = localStorage.getItem(REMOVE_CONFIRM_PREF_KEY) === 'true';
      setDontShowAgain(pref);
      setSkipRemoveConfirm(pref);
    } catch (e) {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id]);

  // Build a LinkedIn profile URL from either a full URL, profile id, or fallback to id
  const buildLinkedInProfileUrl = (): string | null => {
    const raw = connection.linkedin_url || connection.id;
    if (!raw) return null;
    const hasProtocol = /^https?:\/\//i.test(raw);
    return hasProtocol ? raw : `https://www.linkedin.com/in/${raw}`;
  };

  // Navigate to LinkedIn profile on card click (except when removing or clicking buttons)
  const handleCardClick = (e: React.MouseEvent) => {
    if (isRemoving || isConnecting) return;

    const url = buildLinkedInProfileUrl();
    // Only navigate if the original event target wasn't a button inside our controls area
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) return;

    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (onSelect) {
      onSelect(connection);
    }
  };

  /**
   * Handles remove button click events, preventing event bubbling and opening confirmation dialog
   * 
   * @param e - The mouse event
   */
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (skipRemoveConfirm) {
      // Directly remove without showing modal
      void handleConfirmRemove();
    } else {
      setIsDialogOpen(true);
    }
  };

  /**
   * Handles the confirmed removal of a connection by updating its status to 'processed'
   * Shows loading states, success feedback, and error handling with recovery options
   */
  const handleConfirmRemove = async () => {
    setIsRemoving(true);
    setIsDialogOpen(false);

    try {
      // Update status from 'possible' to 'processed' using DBConnector
      // linkedin_url is a LinkedIn profile id (no http)
      const linkedinUrlValue = connection.linkedin_url || connection.id;

      await dbConnector.updateConnectionStatus(connection.id, 'processed', {
        linkedinurl: linkedinUrlValue,
      });

      // Update local cache to remove processed connections from lists
      try {
        const { connectionCache } = await import('@/utils/connectionCache');
        connectionCache.delete(connection.id);
      } catch {}

      // Show success feedback with animation
      toast({
        title: "Connection Removed",
        description: (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>{connection.first_name} {connection.last_name} has been removed from new connections.</span>
          </div>
        ),
        variant: "default",
      });

      // Notify parent component to remove from UI
      if (onRemove) {
        onRemove(connection.id);
      }
    } catch (error) {
      console.error('Error removing connection:', error);

      // Transform error for user-friendly display
      const errorInfo = transformErrorForUser(
        error,
        ERROR_MESSAGES.REMOVE_CONNECTION,
        [
          {
            label: 'Try Again',
            action: () => handleConfirmRemove(),
            primary: true
          },
          {
            label: 'Refresh Page',
            action: () => window.location.reload()
          }
        ]
      );

      // Show error feedback with recovery options
      toast({
        title: "Remove Failed",
        description: errorInfo.userMessage,
        variant: getToastVariant(errorInfo.severity),
      });
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCancelRemove = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsDialogOpen(false);
  };

  const handleDontShowAgainChange = (checked: boolean | 'indeterminate') => {
    const value = checked === true;
    setDontShowAgain(value);
    setSkipRemoveConfirm(value);
    try {
      localStorage.setItem(REMOVE_CONFIRM_PREF_KEY, String(value));
    } catch (e) {
      // ignore storage errors
    }
  };

  /**
   * Handles connect button click events, preventing event bubbling and updating connection status
   * 
   * @param e - The mouse event
   */
  const handleConnectClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Skip if already pending/outgoing
    if (connection.status === 'outgoing') {
      toast({ title: 'Already pending', description: 'Connection request was already sent.', variant: 'default' });
      return;
    }
    setIsConnecting(true);

    try {
      // Call puppeteer backend to send the LinkedIn connection request
      const profileId = connection.linkedin_url || connection.id;
      const resp = await puppeteerApiService.addLinkedInConnection({
        profileId,
        profileName: `${connection.first_name} ${connection.last_name}`,
      });
      if (!resp.success) {
        throw new Error(resp.error || 'Failed to send connection request');
      }

      // Show success feedback
      toast({
        title: "Connection Request Sent",
        description: (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Connection request sent to {connection.first_name} {connection.last_name}.</span>
          </div>
        ),
        variant: "default",
      });

      // Do not update/remove locally here; wait for backend edge update
    } catch (error) {
      console.error('Error connecting:', error);

      // Transform error for user-friendly display
      const errorInfo = transformErrorForUser(
        error,
        ERROR_MESSAGES.UPDATE_CONNECTION,
        [
          {
            label: 'Try Again',
            action: () => handleConnectClick(e),
            primary: true
          },
          {
            label: 'Refresh Page',
            action: () => window.location.reload()
          }
        ]
      );

      // Show error feedback with recovery options
      toast({
        title: "Connect Failed",
        description: errorInfo.userMessage,
        variant: getToastVariant(errorInfo.severity),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className={`p-4 my-3 rounded-lg border cursor-pointer transition-all duration-200 relative ${isRemoving
        ? 'bg-gray-600/20 border-gray-500 opacity-50'
        : 'bg-white/5 border-white/10 hover:bg-white/10'
        }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start space-x-4">
        {/* Profile Picture Space */}
        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
          {connection.first_name[0]}{connection.last_name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            {/* Name of Connection */}
            <h3 className="text-white font-semibold truncate">
              {connection.first_name} {connection.last_name}
            </h3>

            <div className="flex flex-col items-end space-y-1 flex-shrink-0">
              <div className="flex items-center space-x-2">
                {/* Demo Data Badge */}
                {connection.isFakeData && (
                  <div className="bg-yellow-600/90 text-yellow-100 text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                    Demo Data
                  </div>
                )}

                {/* Connect Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
                  onClick={handleConnectClick}
                  disabled={isConnecting || isRemoving}
                  title="Send connection request"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>

                {/* Remove Button - controlled modal open to avoid unwanted popup when preference is set */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  onClick={handleRemoveClick}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <AlertDialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Connection</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {connection.first_name} {connection.last_name} from your new connections?
                        This action will mark them as processed and they won't appear in this list again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="dont-show-remove"
                        checked={dontShowAgain}
                        onCheckedChange={handleDontShowAgainChange}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      />
                      <label
                        htmlFor="dont-show-remove"
                        className="text-sm font-medium text-slate-900 dark:text-slate-100"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        Don’t show this message again when removing a connection
                      </label>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={(e: React.MouseEvent) => handleCancelRemove(e)}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); void handleConfirmRemove(); }}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Conversion Likelihood Percentage */}
              {connection.conversion_likelihood !== undefined && (
                <div className="text-slate-300 text-xs font-medium">
                  {connection.conversion_likelihood}%
                </div>
              )}
            </div>
          </div>

          {/* Job Title and Company on Same Line */}
          <div className="flex items-center text-slate-300 text-sm mb-2 flex-wrap">
            <User className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">{connection.position}</span>
            {connection.company && (
              <>
                <Building className="h-3 w-3 ml-3 mr-1 flex-shrink-0" />
                <span className="truncate">{connection.company}</span>
              </>
            )}
          </div>

          {/* Location */}
          {connection.location && (
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{connection.location}</span>
            </div>
          )}

          {/* Headline */}
          {connection.headline && (
            <p className="text-slate-400 text-sm mb-3 line-clamp-2">
              {connection.headline}
            </p>
          )}



          {/* Tags - Common Interests */}
          {connection.common_interests && connection.common_interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              <Tag className="h-3 w-3 text-slate-400 mr-1 flex-shrink-0" />
              {connection.common_interests.slice(0, 3).map((interest: string, index: number) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs border-blue-400/30 text-blue-300"
                >
                  {interest}
                </Badge>
              ))}
              {connection.common_interests.length > 3 && (
                <Badge
                  variant="outline"
                  className="text-xs border-slate-400/30 text-slate-400"
                >
                  +{connection.common_interests.length - 3} more
                </Badge>
              )}
            </div>
          )}

          {/* Date Added */}
          {connection.date_added && (
            <p className="text-slate-500 text-xs mt-2">
              Added: {new Date(connection.date_added).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewConnectionCard;