import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { useEffect } from "react";

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
        <CardTitle className="text-white">Research</CardTitle>
        <CardDescription className="text-slate-300">
          {isResearching ? 'Research in progress…' : 'Research results'}
        </CardDescription>
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
            <pre className="whitespace-pre-wrap text-slate-100 text-sm bg-white/5 border border-white/10 rounded-md p-3 max-h-[320px] overflow-auto">
              {researchContent}
            </pre>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="text-slate-300 hover:text-white hover:bg-white/10"
                onClick={onClear}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ResearchResultsCard;


