import React, { useEffect, useState } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { MessageSquare, ExternalLink, User, Building, MapPin, Tag } from 'lucide-react';
import type { ConnectionCardProps } from '@/shared/types';

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
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

  const isVanitySlug = (value: string): boolean => /^[a-zA-Z0-9-]+$/.test(value);

  const decodeBase64UrlSafe = (value: string): string | null => {
    try {
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
    const rawLinkedin = (connection.linkedin_url || '').trim();
    if (rawLinkedin) {
      if (isHttpUrl(rawLinkedin)) {
        return rawLinkedin;
      }
      const trimmed = rawLinkedin.replace(/^\/+|\/+$/g, '');
      if (trimmed.toLowerCase().startsWith('in/')) {
        const slug = trimmed.split('/')[1] || '';
        if (slug) return `https://www.linkedin.com/in/${slug}`;
      }
      if (isVanitySlug(trimmed)) {
        return `https://www.linkedin.com/in/${trimmed}`;
      }
    }

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

    const query = [connection.first_name, connection.last_name, connection.company]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (query) {
      return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
    }
    return null;
  };

  const handleClick = () => {
    const url = buildLinkedInProfileUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
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

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMessageClick) {
      onMessageClick(connection);
    }
  };

  const handleOpenSummary = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSummaryOpen(true);
  };

  const handleOpenTags = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTagsOpen(true);
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (onCheckboxChange) {
      onCheckboxChange(connection.id, checked);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const getStatusDisplay = (status?: string) => {
    switch (status) {
      case 'possible':
        return { label: 'New Connection', color: 'bg-green-600/20 text-green-300 border-green-500/30' };
      case 'incoming':
        return { label: 'Pending', color: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30' };
      case 'outgoing':
        return { label: 'Sent', color: 'bg-blue-600/20 text-blue-300 border-blue-500/30' };
      case 'ally':
        return { label: 'Connected', color: 'bg-purple-600/20 text-purple-300 border-purple-500/30' };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay(connection.status);

  const [tagCharBudget, setTagCharBudget] = useState<number>(48);

  useEffect(() => {
    const calculateBudget = () => {
      const width = window.innerWidth;
      let budget = 48;
      if (width < 380) budget = 18;
      else if (width < 640) budget = 26;
      else if (width < 1024) budget = 34;
      setTagCharBudget(budget);
    };
    calculateBudget();
    window.addEventListener('resize', calculateBudget);
    return () => window.removeEventListener('resize', calculateBudget);
  }, []);

  const getVisibleTagsByCharacterBudget = (allTags: string[]) => {
    if (!allTags || allTags.length === 0) {
      return { visible: [] as string[], hasMore: false };
    }
    const reservedForMore = 6;
    const effectiveBudget = Math.max(0, tagCharBudget - reservedForMore);
    let used = 0;
    const visible: string[] = [];
    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i];
      const cost = tag.length + 2;
      if (used + cost > effectiveBudget) break;
      visible.push(tag);
      used += cost;
    }
    return { visible, hasMore: visible.length < allTags.length };
  };

  const [summaryCharBudget, setSummaryCharBudget] = useState<number>(120);

  useEffect(() => {
    const calculateSummaryBudget = () => {
      const width = window.innerWidth;
      let budget = 120;
      if (width < 380) budget = 80;
      else if (width < 640) budget = 96;
      else if (width < 1024) budget = 110;
      setSummaryCharBudget(budget);
    };
    calculateSummaryBudget();
    window.addEventListener('resize', calculateSummaryBudget);
    return () => window.removeEventListener('resize', calculateSummaryBudget);
  }, []);

  const getTruncatedSummary = (text: string) => {
    const normalized = text.trim();
    if (normalized.length <= summaryCharBudget) {
      return { truncated: normalized, hasMore: false };
    }
    const slice = normalized.slice(0, summaryCharBudget);
    const lastSpace = slice.lastIndexOf(' ');
    const safeCut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
    return { truncated: safeCut.trimEnd(), hasMore: true };
  };

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
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {showCheckbox && connection.status === 'ally' && (
            <div className="flex items-center" onClick={handleCheckboxClick}>
              <Checkbox
                checked={isChecked}
                onCheckedChange={handleCheckboxChange}
                disabled={!isCheckboxEnabled}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                aria-label={`Select ${connection.first_name} ${connection.last_name} for messaging`}
              />
            </div>
          )}
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {connection.first_name[0]}{connection.last_name[0]}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-white font-semibold truncate">
              {connection.first_name} {connection.last_name}
            </h3>
            <div className="flex items-center space-x-2 flex-shrink-0">
              {statusDisplay && (
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-1 border ${statusDisplay.color}`}
                >
                  {statusDisplay.label}
                </Badge>
              )}
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

          {(connection.last_action_summary || connection.recent_activity || connection.last_activity_summary) && (() => {
            const full = (connection.last_action_summary || connection.recent_activity || connection.last_activity_summary) as string;
            const { truncated, hasMore } = getTruncatedSummary(full);
            return (
              <div className="text-slate-300 text-sm mb-3">
                <span className="align-baseline">{truncated}</span>
                {hasMore && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={handleOpenSummary}
                      className="text-xs text-blue-200 over:text-blue-100"
                      style={{ marginLeft: '10px' }}
                    >
                      ...more
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {(connection.tags?.length || connection.common_interests?.length) && (() => {
            const allTags = (connection.tags || connection.common_interests || []) as string[];
            const { visible, hasMore } = getVisibleTagsByCharacterBudget(allTags);
            return (
              <div className="mb-2">
                <div className="flex items-center overflow-hidden flex-nowrap gap-2 max-w-full whitespace-nowrap leading-7 min-h-[28px] py-0.5">
                  <Tag className="h-3 w-3 text-slate-400 mr-1 flex-shrink-0" />
                  {visible.map((tag: string, index: number) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className={`cursor-pointer text-xs transition-all duration-200 hover:scale-105 flex-shrink-0 ${
                        activeTags.includes(tag)
                          ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                          : 'border-blue-400/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-400'
                      }`}
                      onClick={(e: React.MouseEvent) => handleTagClick(tag, e)}
                    >
                      {tag}
                    </Badge>
                  ))}
                  {hasMore && (
                    <Badge
                      variant="outline"
                      className="cursor-pointer text-xs border-slate-400/30 text-slate-400 flex-shrink-0 ml-1 transition-all duration-200 hover:scale-[1.2] hover:bg-slate-500/20 hover:border-slate-400/50 hover:text-slate-200"
                      onClick={handleOpenTags}
                    >
                      +{allTags.length - visible.length} more
                    </Badge>
                  )}
                </div>
              </div>
            );
          })()}

          {connection.date_added && (
            <p className="text-slate-500 text-xs mt-2">
              Added: {new Date(connection.date_added).toLocaleDateString()}
            </p>
          )}

          {isNewConnection && !connection.linkedin_url && (
            <p className="text-yellow-400 text-xs mt-2 flex items-center">
              <ExternalLink className="h-3 w-3 mr-1" />
              Click to search LinkedIn for this profile
            </p>
          )}
        </div>
      </div>

      <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
        <DialogContent className="text-slate-100 bg-slate-900 border border-slate-700 shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-white">Summary</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-100 whitespace-pre-wrap">
            {connection.last_action_summary || connection.recent_activity || connection.last_activity_summary}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTagsOpen} onOpenChange={setIsTagsOpen}>
        <DialogContent className="text-slate-100 bg-slate-900 border border-slate-700 shadow-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-white">Tags</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {(connection.tags || connection.common_interests || []).map((tag: string, index: number) => (
              <Badge
                key={`all-${index}`}
                variant="outline"
                className={`cursor-pointer text-xs transition-all duration-200 hover:scale-105 ${
                  activeTags.includes(tag)
                    ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                    : 'border-blue-400/30 text-blue-300 hover:bg-blue-600/20 hover:border-blue-400'
                }`}
                onClick={(e: React.MouseEvent) => handleTagClick(tag, e)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConnectionCard;
