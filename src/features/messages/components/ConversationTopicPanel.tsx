import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Square } from 'lucide-react';

interface ConversationTopicPanelProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  onGenerateMessages: () => void;
  selectedConnectionsCount: number;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  currentConnectionName?: string;
}

const ConversationTopicPanel = ({ 
  topic, 
  onTopicChange, 
  onGenerateMessages, 
  selectedConnectionsCount,
  isGenerating = false,
  onStopGeneration,
  currentConnectionName
}: ConversationTopicPanelProps) => {
  const isGenerateDisabled = selectedConnectionsCount === 0 || !topic.trim();
  
  const handleButtonClick = () => {
    if (isGenerating && onStopGeneration) {
      onStopGeneration();
    } else {
      onGenerateMessages();
    }
  };

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Sparkles className="h-5 w-5 mr-2" />
          Conversation Topic
        </CardTitle>
        <CardDescription className="text-slate-300">
          {isGenerating && currentConnectionName 
            ? `Generating message for ${currentConnectionName}...`
            : "What would you like to discuss with your selected connections?"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., AI trends in product development, career advice, collaboration opportunities..."
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder-slate-400 min-h-[100px]"
          disabled={isGenerating}
        />
        <Button
          onClick={handleButtonClick}
          disabled={!isGenerating && isGenerateDisabled}
          className={`w-full text-white ${
            isGenerating 
              ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800" 
              : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          }`}
        >
          {isGenerating ? (
            <>
              <Square className="h-4 w-4 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Generate Personalized Messages
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ConversationTopicPanel;
