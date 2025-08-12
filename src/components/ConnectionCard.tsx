import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, ExternalLink, User, Building, MapPin, Tag } from 'lucide-react';
import type { Connection, ConnectionCardProps } from '@/types';

/**
 * ConnectionCard Component
 * 
 * Displays a connection's information in a card format with interactive elements.
 * Supports both regular connections and new connection variants with different
 * styling and behavior patterns. Includes checkbox functionality for selecting
 * allies connections for messaging workflows.
 * 
 * @param props - The component props
 * @param props.connection - Connection data to display
 * @param props.isSelected - Whether this card is currently selected
 * @param props.isNewConnection - Whether this is a new connection card variant
 * @param props.onSelect - Callback when card is selected
 * @param props.onNewConnectionClick - Callback for new connection card clicks
 * @param props.onTagClick - Callback when a tag is clicked
 * @param props.onMessageClick - Callback when message count is clicked
 * @param props.activeTags - Array of currently active/selected tags
 * @param props.className - Additional CSS classes
 * @param props.showCheckbox - Whether to show checkbox for connection selection
 * @param props.isCheckboxEnabled - Whether the checkbox is enabled (only for allies status)
 * @param props.isChecked - Whether the checkbox is checked
 * @param props.onCheckboxChange - Callback when checkbox state changes
 * 
 * @returns JSX element representing the connection card
 */
const ConnectionCard = ({ 
  connection, 
  isSelected = false, 
  isNewConnection = false,
  onSelect,
  onNewConnectionClick,
  onTagClick,
  onMessageClick,
  activeTags = [],
  showCheckbox = false,
  isCheckboxEnabled = false,
  isChecked = false,
  onCheckboxChange
}: ConnectionCardProps) => {
  const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

  const isVanitySlug = (value: string): boolean => /^[a-zA-Z0-9-]+$/.test(value);

  const decodeBase64UrlSafe = (value: string): string | null => {
    try {
      // Normalize URL-safe base64 to standard base64 and add padding
      let normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const pad = normalized.length % 4;
      if (pad === 2) normalized += '==';
      if (pad === 3) normalized += '=';
      const decoded = atob(normalized);
      return decoded;
    } catch {
      return null;
    }
  };

  const buildLinkedInProfileUrl = (): string | null => {
    // 1) Prefer explicit linkedin_url when present
    const rawLinkedin = (connection.linkedin_url || '').trim();
    if (rawLinkedin) {
      if (isHttpUrl(rawLinkedin)) {
        return rawLinkedin;
      }
      const trimmed = rawLinkedin.replace(/^\/+|\/+$/g, '');
      // Handle formats like "in/vanity" or just "vanity"
      if (trimmed.toLowerCase().startsWith('in/')) {
        const slug = trimmed.split('/')[1] || '';
        if (slug) return `https://www.linkedin.com/in/${slug}`;
      }
      if (isVanitySlug(trimmed)) {
        return `https://www.linkedin.com/in/${trimmed}`;
      }
      // If it's not a clean vanity slug, fall through to ID decode
    }

    // 2) Try decoding id (our types state this is base64-encoded LinkedIn URL)
    if (connection.id) {
      const decoded = decodeBase64UrlSafe(connection.id);
      if (decoded) {
        const cleaned = decoded.trim();
        if (isHttpUrl(cleaned)) {
          return cleaned;
        }
        const trimmed = cleaned.replace(/^\/+|\/+$/g, '');
        if (trimmed.toLowerCase().startsWith('in/')) {
          return `https://www.linkedin.com/${trimmed}`;
        }
        if (isVanitySlug(trimmed)) {
          return `https://www.linkedin.com/in/${trimmed}`;
        }
      }
    }

    // 3) Last resort: people search with name + company
    const query = [connection.first_name, connection.last_name, connection.company]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (query) {
      return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
    }
    return null;
  };

  /**
   * Handles card click events, opening LinkedIn profile in new tab
   */
  const handleClick = () => {
    const url = buildLinkedInProfileUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Final fallback: use existing callback logic
    if (isNewConnection && onNewConnectionClick) {
      onNewConnectionClick(connection);
    } else if (onSelect) {
      onSelect(connection.id);
    }
  };

  /**
   * Handles tag click events, preventing event bubbling and triggering tag callback
   * 
   * @param tag - The tag that was clicked
   * @param e - The mouse event
   */
  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  /**
   * Handles message count click events, preventing event bubbling and triggering message callback
   * 
   * @param e - The mouse event
   */
  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMessageClick) {
      onMessageClick(connection);
    }
  };

  /**
   * Handles checkbox change events, preventing event bubbling and triggering checkbox callback
   * 
   * @param checked - The new checked state
   */
  const handleCheckboxChange = (checked: boolean) => {
    if (onCheckboxChange) {
      onCheckboxChange(connection.id, checked);
    }
  };

  /**
   * Handles checkbox click events to prevent event bubbling
   * 
   * @param e - The mouse event
   */
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  /**
   * Maps connection status to human-readable display configuration
   * 
   * @param status - The connection status to map
   * @returns Display configuration object with label and color classes, or null if invalid
   */
  const getStatusDisplay = (status?: string) => {
    switch (status) {
      case 'possible':
        return { label: 'New Connection', color: 'bg-green-600/20 text-green-300 border-green-500/30' };
      case 'incoming':
        return { label: 'Pending', color: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30' };
      case 'outgoing':
        return { label: 'Sent', color: 'bg-blue-600/20 text-blue-300 border-blue-500/30' };
      case 'allies':
        return { label: 'Connected', color: 'bg-purple-600/20 text-purple-300 border-purple-500/30' };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay(connection.status);

  return (
    <div
      className={`p-4 my-3 rounded-lg border cursor-pointer transition-all duration-200 relative ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-4">
        {/* Checkbox for connection selection - only show for allies status */}
        {showCheckbox && connection.status === 'allies' && (
          <div className="flex items-center pt-1" onClick={handleCheckboxClick}>
            <Checkbox
              checked={isChecked}
              onCheckedChange={handleCheckboxChange}
              disabled={!isCheckboxEnabled}
              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              aria-label={`Select ${connection.first_name} ${connection.last_name} for messaging`}
            />
          </div>
        )}
        
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
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Connection Status Badge */}
              {statusDisplay && (
                <Badge 
                  variant="outline" 
                  className={`text-xs px-2 py-1 border ${statusDisplay.color}`}
                >
                  {statusDisplay.label}
                </Badge>
              )}
              {/* Demo Data Badge */}
              {connection.isFakeData && (
                <div className="bg-yellow-600/90 text-yellow-100 text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                  Demo Data
                </div>
              )}
              {connection.messages !== undefined && (
                <div 
                  className={`flex items-center text-sm transition-all duration-200 ${
                    onMessageClick && connection.messages > 0
                      ? 'text-slate-300 hover:text-blue-300 cursor-pointer hover:bg-blue-600/10 px-2 py-1 rounded'
                      : connection.messages === 0
                      ? 'text-slate-500'
                      : 'text-slate-300'
                  }`}
                  onClick={onMessageClick && connection.messages > 0 ? handleMessageClick : undefined}
                  title={
                    connection.messages === 0 
                      ? 'No messages yet' 
                      : onMessageClick 
                      ? 'Click to view message history' 
                      : undefined
                  }
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {connection.messages === 0 ? 'No messages' : connection.messages}
                </div>
              )}
              {isNewConnection && connection.linkedin_url && (
                <ExternalLink className="h-4 w-4 text-blue-400" />
              )}
              {isSelected && (
                <Badge className="bg-blue-600 text-white">Selected</Badge>
              )}
            </div>
          </div>
          
          {/* Job Title and Place of Work on Same Line */}
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
          
          {connection.location && (
            <div className="flex items-center text-slate-400 text-sm mb-2">
              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">{connection.location}</span>
            </div>
          )}
          
          {/* Short Summary of Last Action */}
          {(connection.last_action_summary || connection.recent_activity || connection.last_activity_summary) && (
            <p className="text-slate-400 text-sm mb-3 line-clamp-2">
              {connection.last_action_summary || connection.recent_activity || connection.last_activity_summary}
            </p>
          )}
          
          {/* Tags - Clickable for Sorting */}
          {(connection.tags?.length || connection.common_interests?.length) && (
            <div className="flex flex-wrap gap-2 mb-2">
              <Tag className="h-3 w-3 text-slate-400 mr-1 flex-shrink-0" />
              {(connection.tags || connection.common_interests || []).map((tag: string, index: number) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className={`cursor-pointer text-xs transition-all duration-200 hover:scale-105 ${
                    activeTags.includes(tag)
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                      : 'border-blue-400/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-400'
                  }`}
                  onClick={(e) => handleTagClick(tag, e)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          
          {connection.date_added && (
            <p className="text-slate-500 text-xs mt-2">
              Added: {new Date(connection.date_added).toLocaleDateString()}
            </p>
          )}
          
          {/* Warning for missing LinkedIn URL in new connections */}
          {isNewConnection && !connection.linkedin_url && (
            <p className="text-yellow-400 text-xs mt-2 flex items-center">
              <ExternalLink className="h-3 w-3 mr-1" />
              Click to search LinkedIn for this profile
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionCard;
