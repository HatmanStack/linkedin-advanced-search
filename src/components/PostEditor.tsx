import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { FileText, Save, Send, X } from 'lucide-react';
import { useUserProfile } from '../contexts/UserProfileContext';
import { usePostComposer } from '../contexts/PostComposerContext';
import { useState, useMemo } from 'react';

interface PostEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSaveDraft: () => void;
  onPublishPost: () => void;
  isSavingDraft: boolean;
  isPublishing: boolean;
  isSynthesizing?: boolean;
  onSynthesizeResearch?: () => void;
}

const PostEditor = ({
  content,
  onContentChange,
  onSaveDraft,
  onPublishPost,
  isSavingDraft,
  isPublishing,
  isSynthesizing,
  onSynthesizeResearch
}: PostEditorProps) => {
  const { userProfile } = useUserProfile();
  const { postReasoning, postHook, clearSynthesis } = usePostComposer();
  const [selectedStyle, setSelectedStyle] = useState<string>('neutral');
  const hasSynthesized = useMemo(() => {
    return Boolean(
      postHook || postReasoning
    );
  }, [postHook, postReasoning]);
  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Create LinkedIn Post
        </CardTitle>
        <CardDescription className="text-slate-300">
          Compose engaging content for your LinkedIn audience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {postHook && (
          <div className="rounded-md border border-blue-400/30 bg-blue-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">Suggested Hook</div>
            <div className="text-slate-100 whitespace-pre-wrap">{postHook}</div>
          </div>
        )}
        <Textarea
          placeholder="What's on your mind? Share insights, experiences, or industry thoughts..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder-slate-400 min-h-[200px]"
        />
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">
            {content.length}/3000 characters
          </span>
          <div className="space-x-2">
            <Button
              className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSavingDraft ? 'Saving...' : 'Save'}
            </Button>
            {hasSynthesized ? (
              <div className="inline-flex items-center gap-2 align-middle">
                <Label htmlFor="style-select" className="text-slate-300 text-sm">Writing style</Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger id="style-select" className="w-[180px] bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Choose style" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-white/20 text-white">
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="inspirational">Inspirational</SelectItem>
                    <SelectItem value="analytical">Analytical</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              onSynthesizeResearch && (
                <Button
                  className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
                  onClick={onSynthesizeResearch}
                  disabled={isSynthesizing}
                  title="Synthesize research into a concise post"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isSynthesizing ? 'Synthesizing...' : 'Synthesize Research'}
                </Button>
              )
            )}
            <Button
              disabled={!content.trim() || isPublishing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              onClick={onPublishPost}
            >
              <Send className="h-4 w-4 mr-2" />
              {isPublishing ? 'Publishing...' : 'Publish Post'}
            </Button>
          </div>
        </div>
        {postReasoning && (
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between">
              <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">Reasoning</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                onClick={clearSynthesis}
                title="Clear synthesis"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-slate-200 whitespace-pre-wrap">{postReasoning}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostEditor;


