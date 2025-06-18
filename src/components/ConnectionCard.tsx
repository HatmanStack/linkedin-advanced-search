import { Badge } from "@/components/ui/badge";
import { MessageSquare, ExternalLink, User, Building, MapPin, Tag } from 'lucide-react';

interface Connection {
  id: string;
  first_name: string;
  last_name: string;
  position: string;
  company: string;
  location?: string;
  headline?: string;
  recent_activity?: string;
  common_interests?: string[];
  messages?: number;
  date_added?: string;
  linkedin_url?: string;
  tags?: string[];
  last_action_summary?: string;
  isFakeData?: boolean;
  last_activity_summary?: string;
}

interface ConnectionCardProps {
  connection: Connection;
  isSelected?: boolean;
  isNewConnection?: boolean;
  onSelect?: (connectionId: string) => void;
  onNewConnectionClick?: (connection: Connection) => void;
  onTagClick?: (tag: string) => void;
  activeTags?: string[];
}

const ConnectionCard = ({ 
  connection, 
  isSelected = false, 
  isNewConnection = false,
  onSelect,
  onNewConnectionClick,
  onTagClick,
  activeTags = []
}: ConnectionCardProps) => {
  const handleClick = () => {
    if (isNewConnection && onNewConnectionClick) {
      onNewConnectionClick(connection);
    } else if (onSelect) {
      onSelect(connection.id);
    }
  };

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 relative ${
        isSelected
          ? 'bg-blue-600/20 border-blue-500'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
      }`}
      onClick={handleClick}
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
            <div className="flex items-center space-x-2 flex-shrink-0">
              {/* Demo Data Badge */}
              {connection.isFakeData && (
                <div className="bg-yellow-600/90 text-yellow-100 text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                  Demo Data
                </div>
              )}
              {connection.messages !== undefined && (
                <div className="flex items-center text-slate-300 text-sm">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {connection.messages}
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
          {(connection.tags || connection.common_interests) && (
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
