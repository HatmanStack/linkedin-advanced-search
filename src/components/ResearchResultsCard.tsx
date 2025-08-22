import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResearchResultsCardProps {
  isResearching: boolean;
  onClear: () => void;
}

const RESEARCH_STORAGE_KEY = 'ai_research_content';

const ResearchResultsCard = ({
  isResearching,
  onClear,
  
}: ResearchResultsCardProps) => {
  const [localResearch, setLocalResearch] = useState<string | null>(null);

  // Local hydration from sessionStorage on mount and whenever research completes
  useEffect(() => {
    if (!isResearching) {
      try {
        const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
        setLocalResearch(stored ?? null);
      } catch {
        setLocalResearch(null);
      }
    }
  }, [isResearching]);

  if (!isResearching && !localResearch) return null;

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-white">Research</CardTitle>
            <CardDescription className="text-slate-300">
              {isResearching ? 'Research in progress…' : 'Research results'}
            </CardDescription>
          </div>
          {localResearch && !isResearching ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={() => { setLocalResearch(null); onClear(); }}
              title="Clear research"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isResearching && (
          <div className="flex items-center text-slate-300 text-sm">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            This may take several minutes.
          </div>
        )}
        {localResearch && (
          <div className="space-y-3">
            <div className="text-white prose prose-invert max-w-none whitespace-pre-wrap break-words prose-h1:text-center prose-headings:text-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ node, ...props }) => (
                    <p {...props} />
                  ),
                  h1: ({ node, ...props }) => (
                    <h1 {...props} className="text-center text-white -mb-2" />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 {...props} className="text-center text-white -mb-2" />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 {...props} className="text-white -mb-2" />
                  ),
                  h4: ({ node, ...props }) => (
                    <h4 {...props} className="text-white -mb-2" />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul
                      {...props}
                      className="list-none pl-0 my-1 space-y-1"
                      style={{ listStyleType: 'none'}}
                    />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol
                      {...props}
                      className="list-none pl-0 my-1 space-y-1"
                      style={{ listStyleType: 'none'}}
                    />
                  ),
                  li: ({ node, ...props }) => (
                    <li
                      {...props}
                      className="pl-0 my-0.5 marker:text-transparent before:hidden"
                    />
                  ),
                }}
              >
                {localResearch}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ResearchResultsCard;


