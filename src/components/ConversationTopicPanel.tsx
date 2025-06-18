import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send } from 'lucide-react';

interface ConversationTopicPanelProps {
  topic: string;
  onTopicChange: (topic: string) => void;
  onGenerateMessages: () => void;
  selectedConnectionsCount: number;
}

const ConversationTopicPanel = ({ 
  topic, 
  onTopicChange, 
  onGenerateMessages, 
  selectedConnectionsCount 
}: ConversationTopicPanelProps) => {
  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Sparkles className="h-5 w-5 mr-2" />
          Conversation Topic
        </CardTitle>
        <CardDescription className="text-slate-300">
          What would you like to discuss with your selected connections?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., AI trends in product development, career advice, collaboration opportunities..."
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder-slate-400 min-h-[100px]"
        />
        <Button
          onClick={onGenerateMessages}
          disabled={selectedConnectionsCount === 0 || !topic}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          <Send className="h-4 w-4 mr-2" />
          Generate Personalized Messages
        </Button>
      </CardContent>
    </Card>
  );
};

export default ConversationTopicPanel;
