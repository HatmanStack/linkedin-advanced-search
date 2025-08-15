import { useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, Search } from 'lucide-react';

interface PostAIAssistantProps {
  onGenerateIdeas: (prompt?: string) => void;
  onResearchTopics: (query: string) => void;
  onResearchSelectedIdeas: (selectedIdeas: string[]) => void;
  onValidationError: (message: string) => void;
  isGeneratingIdeas: boolean;
  isResearching: boolean;
  ideas?: string[];
  onClearIdeas?: () => void;
}

const PostAIAssistant = ({ 
  onGenerateIdeas, 
  onResearchTopics, 
  onResearchSelectedIdeas,
  onValidationError,
  isGeneratingIdeas, 
  isResearching,
  ideas,
  onClearIdeas
}: PostAIAssistantProps) => {
  const [showResearchInput, setShowResearchInput] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());

  const handleResearchSubmit = () => {
    if (researchQuery.trim()) {
      onResearchTopics(researchQuery);
      setShowResearchInput(false);
      setResearchQuery('');
    }
  };

  const handleGenerateIdeas = () => {
    onGenerateIdeas(ideaPrompt.trim() || undefined);
  };

  const handleClearIdeas = () => {
    setSelectedIdeas(new Set());
    onClearIdeas?.();
  };

  const handleIdeaToggle = (index: number) => {
    const newSelected = new Set(selectedIdeas);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIdeas(newSelected);
  };

  const handleResearchTopicsClick = () => {
    if (ideas && ideas.length > 0) {
      // If we have ideas, check if any are selected
      if (selectedIdeas.size === 0) {
        onValidationError('Please select at least one idea.');
        return;
      }
      
      // Get the selected ideas and send them for research
      const selectedIdeasList = Array.from(selectedIdeas).map(index => ideas[index]);
      onResearchSelectedIdeas(selectedIdeasList);
    } else {
      // No ideas, show the research input as before
      setShowResearchInput(!showResearchInput);
    }
  };

  const renderIdeasList = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold">Generated Ideas</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearIdeas}
          className="text-slate-300 border-slate-600 hover:bg-slate-600 hover:text-white"
        >
          Clear Ideas
        </Button>
      </div>
      <div className="space-y-2">
        {ideas?.map((idea, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-white/5 rounded-md border border-white/10">
            <input
              type="checkbox"
              id={`idea-${index}`}
              checked={selectedIdeas.has(index)}
              onChange={() => handleIdeaToggle(index)}
              className="mt-1 h-4 w-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500/40 focus:ring-2"
            />
            <label htmlFor={`idea-${index}`} className="text-slate-300 text-sm leading-relaxed cursor-pointer flex-1">
              {idea}
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTextarea = () => (
    <textarea
      placeholder="Optional idea prompt..."
      value={ideaPrompt}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setIdeaPrompt(e.target.value)}
      rows={3}
      className="w-full bg-white/5 border border-white/20 text-white placeholder-slate-400 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/40"
    />
  );

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
          {ideas && ideas.length > 0 ? renderIdeasList() : renderTextarea()}
          
          {!ideas || ideas.length === 0 ? (
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              onClick={handleGenerateIdeas}
              disabled={isGeneratingIdeas}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isGeneratingIdeas ? 'Generating...' : 'Generate Ideas'}
            </Button>
          ) : null}
          
          <Button 
            className="w-full bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
            onClick={handleResearchTopicsClick}
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
