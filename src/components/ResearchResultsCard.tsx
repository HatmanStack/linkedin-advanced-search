import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useEffect } from "react";
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResearchResultsCardProps {
  isResearching: boolean;
  researchContent: string | null;
  onClear: () => void;
}

const ResearchResultsCard = ({
  isResearching,
  researchContent,
  onClear,
  
}: ResearchResultsCardProps) => {
  useEffect(() => {
    // No-op, placeholder for future side effects
  }, [researchContent]);

  if (!isResearching && !researchContent) return null;

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
          {researchContent && !isResearching ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={onClear}
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
        {researchContent && (
          <div className="space-y-3">
            <div className="text-white prose prose-invert max-w-none whitespace-pre-wrap break-words prose-h1:text-center prose-headings:text-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 {...props} className="text-center text-white" />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul
                      {...props}
                      className="list-none pl-0 my-1 space-y-1"
                      style={{ listStyleType: 'none', marginTop: '0.25rem', marginBottom: '0.25rem' }}
                    />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol
                      {...props}
                      className="list-none pl-0 my-1 space-y-1"
                      style={{ listStyleType: 'none', marginTop: '0.25rem', marginBottom: '0.25rem' }}
                    />
                  ),
                  li: ({ node, ...props }) => (
                    <li
                      {...props}
                      className="pl-0 my-0.5 marker:text-transparent before:hidden"
                      style={{ marginTop: '0.125rem', marginBottom: '0.125rem' }}
                    />
                  ),
                }}
              >
                {researchContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResearchResultsCard;


