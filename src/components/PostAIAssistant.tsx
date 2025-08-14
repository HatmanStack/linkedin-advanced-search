import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, Search } from 'lucide-react';

interface PostAIAssistantProps {
  onGenerateIdeas: () => void;
  onResearchTopics: (query: string) => void;
  isGeneratingIdeas: boolean;
  isResearching: boolean;
}

const PostAIAssistant = ({ 
  onGenerateIdeas, 
  onResearchTopics, 
  isGeneratingIdeas, 
  isResearching 
}: PostAIAssistantProps) => {
  const [showResearchInput, setShowResearchInput] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');

  const handleResearchSubmit = () => {
    if (researchQuery.trim()) {
      onResearchTopics(researchQuery);
      setShowResearchInput(false);
      setResearchQuery('');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader>
          <CardTitle className="text-white">AI Assistant</CardTitle>
          <CardDescription className="text-slate-300">
            Get help with content ideas and optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            placeholder="Optional idea prompt..."
            value={ideaPrompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setIdeaPrompt(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/20 text-white placeholder-slate-400 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          />
          <Button 
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            onClick={onGenerateIdeas}
            disabled={isGeneratingIdeas}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isGeneratingIdeas ? 'Generating...' : 'Generate Ideas'}
          </Button>
          <Button 
            className="w-full bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
            onClick={() => setShowResearchInput(!showResearchInput)}
          >
            <Search className="h-4 w-4 mr-2" />
            Research Topics
          </Button>
          
          {showResearchInput && (
            <div className="space-y-2">
              <Input
                placeholder="Enter research topic..."
                value={researchQuery}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setResearchQuery(e.target.value)}
                className="bg-white/5 border-white/20 text-white placeholder-slate-400"
                onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleResearchSubmit()}
              />
              <Button
                onClick={handleResearchSubmit}
                disabled={isResearching}
                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white"
              >
                <Search className="h-4 w-4 mr-2" />
                {isResearching ? 'Researching...' : 'Search'}
              </Button>
            </div>
          )}
          
          
        </CardContent>
      </Card>

      <Card className="bg-slate-700 bg-gradient-to-r from-green-600/20 to-blue-600/20 backdrop-blur-md border-white/10">
        <CardContent className="p-4">
          <h4 className="text-white font-semibold mb-2">📝 Writing Tips</h4>
          <ul className="text-slate-300 text-sm space-y-1">
            <li>• Start with a hook</li>
            <li>• Share personal insights</li>
            <li>• Include a call-to-action</li>
            <li>• Use relevant hashtags</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default PostAIAssistant;
