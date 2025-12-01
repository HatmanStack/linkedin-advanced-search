import { useState, type ChangeEvent, type KeyboardEvent, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Sparkles, Search, X } from 'lucide-react';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PostAIAssistant');

interface PostAIAssistantProps {
  onGenerateIdeas: (prompt?: string) => Promise<void>;
  onResearchTopics: (topics: string[]) => void;
  onValidationError: (message: string) => void;
  isGeneratingIdeas: boolean;
  isResearching: boolean;
  ideas?: string[];
  onIdeasUpdate?: (newIdeas: string[]) => Promise<void>;
}

const SELECTED_IDEAS_STORAGE_KEY = 'ai_selected_ideas';

const PostAIAssistant = ({ 
  onGenerateIdeas, 
  onResearchTopics, 
  isGeneratingIdeas, 
  isResearching,
  ideas,
  onIdeasUpdate
}: PostAIAssistantProps) => {
  const [showResearchInput, setShowResearchInput] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());
  const [localIdeas, setLocalIdeas] = useState<string[]>([]);

  const IDEAS_STORAGE_KEY = 'ai_generated_ideas';

  useEffect(() => {
    try {
      const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
      let parsed: string[] | null = null;
      if (storedIdeas) {
        parsed = JSON.parse(storedIdeas);
        setLocalIdeas(parsed ?? []);
      }
      const storedSelected = sessionStorage.getItem(SELECTED_IDEAS_STORAGE_KEY);
      if (storedSelected) {
        const selectedList: string[] = JSON.parse(storedSelected);
        const indices = new Set<number>();
        (parsed || localIdeas).forEach((idea: string, idx: number) => {
          if (selectedList.includes(idea)) indices.add(idx);
        });
        if (indices.size > 0) setSelectedIdeas(indices);
      }
    } catch (error) {
      logger.error('Failed to load ideas/selection from session storage', { error });
    }
  }, []);

  useEffect(() => {
    if (ideas && ideas.length > 0) {
      setLocalIdeas(ideas);
      try {
        sessionStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
      } catch (error) {
        logger.error('Failed to save ideas to session storage', { error });
      }
    }
  }, [ideas]);

  useEffect(() => {
    try {
      const selectedTexts = Array.from(selectedIdeas).map(idx => localIdeas[idx]).filter(Boolean);
      sessionStorage.setItem(SELECTED_IDEAS_STORAGE_KEY, JSON.stringify(selectedTexts));
    } catch (e) {
      logger.error('Failed to persist selected ideas', { error: e });
    }
  }, [selectedIdeas, localIdeas]);

  const handleResearchSubmit = () => {
    if (researchQuery.trim()) {
      onResearchTopics([researchQuery.trim()]);
      setShowResearchInput(false);
      setResearchQuery('');
    }
  };

  const handleGenerateIdeas = () => {
    onGenerateIdeas(ideaPrompt.trim() || undefined);
  };

  const handleDeleteIdea = async (index: number) => {
    const newIdeas = localIdeas.filter((_, i) => i !== index);
    setLocalIdeas(newIdeas);
    
    try {
      sessionStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(newIdeas));
    } catch (error) {
      logger.error('Failed to update ideas in session storage', { error });
    }
    
    const newSelected = new Set(selectedIdeas);
    newSelected.delete(index);
    const adjustedSelected = new Set<number>();
    newSelected.forEach(selectedIndex => {
      if (selectedIndex > index) {
        adjustedSelected.add(selectedIndex - 1);
      } else {
        adjustedSelected.add(selectedIndex);
      }
    });
    setSelectedIdeas(adjustedSelected);
    
    if (onIdeasUpdate) {
      await onIdeasUpdate(newIdeas);
    }
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
    const hasCustomTopic = Boolean(ideaPrompt.trim());
    const hasSelected = Boolean(localIdeas && localIdeas.length > 0 && selectedIdeas.size > 0);

    if (hasCustomTopic) {
      onResearchTopics([ideaPrompt.trim()]);
      setIdeaPrompt('');
      return;
    }
    
    if (hasSelected) {
      const selectedIdeasList = Array.from(selectedIdeas).map(index => localIdeas[index]);
      onResearchTopics(selectedIdeasList);
      return;
    }
    
    setShowResearchInput(false);
  };

  const renderIdeasList = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-white font-semibold">Generated Ideas</h4>
      </div>
      <div className="space-y-2">
        {localIdeas?.map((idea, index) => (
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
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={() => handleDeleteIdea(index)}
              title="Delete idea"
            >
              <X className="h-4 w-4" />
            </Button>
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
          {localIdeas && localIdeas.length > 0 ? renderIdeasList() : renderTextarea()}
          
          {!localIdeas || localIdeas.length === 0 ? (
            <Button 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
              onClick={handleGenerateIdeas}
              disabled={isGeneratingIdeas}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isGeneratingIdeas ? 'Generating...' : 'Generate Ideas'}
            </Button>
          ) : null}
          
          {(() => {
            const hasCustomTopic = Boolean(ideaPrompt.trim());
            const hasSelected = Boolean(localIdeas && localIdeas.length > 0 && selectedIdeas.size > 0);
            const canResearch = hasCustomTopic || hasSelected;
            return (
              <Button 
                className="w-full bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
                onClick={handleResearchTopicsClick}
                disabled={isResearching || !canResearch}
                title={!canResearch ? 'Enter a topic above or select at least one idea to research' : undefined}
              >
                <Search className="h-4 w-4 mr-2" />
                {hasCustomTopic ? 'Research Custom Topic' : 
                 hasSelected ? 'Research Selected Ideas' : 'Research Topics'}
              </Button>
            );
          })()}
          
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
