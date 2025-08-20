import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { FileText, Save, Send, X } from 'lucide-react';
import { usePostComposer } from '../contexts/PostComposerContext';
import { useState, useMemo, useEffect } from 'react';
import { postsService } from '../services/postsService';

const REASONING_STORAGE_KEY = 'ai_generated_post_reasoning';
const HOOK_STORAGE_KEY = 'ai_generated_post_hook';
const CONTENT_STORAGE_KEY = 'post_editor_content';
const STYLE_CACHE_KEY = 'post_style_cache';

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
  const { postReasoning, postHook, clearSynthesis } = usePostComposer();
  const [localReasoning, setLocalReasoning] = useState<string | null>(null);
  const [localHook, setLocalHook] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('default');
  const [isFormatting, setIsFormatting] = useState<boolean>(false);
  const [localHydratedContent, setLocalHydratedContent] = useState<string>(content);
  const hasSynthesized = useMemo(() => {
    return Boolean((localHook ?? postHook) || (localReasoning ?? postReasoning));
  }, [postHook, postReasoning, localHook, localReasoning]);

  // Local hydration for reasoning and hook from sessionStorage
  useEffect(() => {
    try {
      if (postReasoning && postReasoning !== localReasoning) {
        setLocalReasoning(postReasoning);
      } else if (!postReasoning) {
        const storedReasoning = sessionStorage.getItem(REASONING_STORAGE_KEY);
        setLocalReasoning(storedReasoning ?? null);
      }

      if (postHook && postHook !== localHook) {
        setLocalHook(postHook);
      } else if (!postHook) {
        const storedHook = sessionStorage.getItem(HOOK_STORAGE_KEY);
        setLocalHook(storedHook ?? null);
      }
    } catch {}
  }, [postReasoning, postHook]);

  // Hydrate content from sessionStorage on mount if empty (mirrors ideas/research patterns)
  useEffect(() => {
    if (!content || content.length === 0) {
      try {
        const stored = sessionStorage.getItem(CONTENT_STORAGE_KEY);
        if (stored) {
          onContentChange(stored);
          setLocalHydratedContent(stored);
        }
      } catch {}
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleStyleChange = async (value: string) => {
    setSelectedStyle(value);
    // Revert to original when Default is selected
    if (value === 'default') {
      onContentChange(localHydratedContent);
      return;
    }

    const raw = sessionStorage.getItem(STYLE_CACHE_KEY);
    
    const parsed = JSON.parse(raw ?? '{}');
    console.log('Parsed',  parsed);
    if (parsed[value]) {
      onContentChange(parsed[value]);
      return;
    }
    setIsFormatting(true);
    try {
      const styled = await postsService.applyPostStyle(localHydratedContent, value);
      // Ignore if a newer job started meanwhile
      
      onContentChange(styled);    
      parsed[value] = styled;
      setIsFormatting(false);
      sessionStorage.setItem(STYLE_CACHE_KEY, JSON.stringify(parsed));  
    } catch (err) {
      // Ignore failure and keep original content
      console.error('Failed to apply post style', err);
    } 
  };


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
        {(localHook ?? postHook) && (
          <div className="rounded-md border border-blue-400/30 bg-blue-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-blue-300 mb-1">Suggested Hook</div>
            <div className="text-slate-100 text-sm whitespace-pre-wrap">{(localHook ?? postHook) as string}</div>
          </div>
        )}
        <Textarea
          placeholder="Share your thoughts, experiences, or use Synthesize to turn the current post, ideas, and/or research into a post."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder-slate-400 min-h-[400px]"
        />
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">
            {content.length}/3000 characters
          </span>
          <div className="flex items-center gap-2">
            <Button
              className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSavingDraft ? 'Saving...' : 'Save'}
            </Button>
            {hasSynthesized ? (
              <div className="flex items-center gap-2 h-10">
                <Label htmlFor="style-select" className="inline-flex items-center h-10 text-slate-300 text-sm">Writing style</Label>
                {isFormatting ? (
                  <span className="inline-flex items-center h-10 w-[180px] ml-3 text-xs text-slate-400">Formatting…</span>
                ) : (
                <Select value={selectedStyle} onValueChange={handleStyleChange}>
                  <SelectTrigger id="style-select" className="h-10 w-[180px] bg-white/5 border-white/20 text-white">
                    <SelectValue placeholder="Choose style" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-white/20 text-white">
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="inspirational">Inspirational</SelectItem>
                    <SelectItem value="analytical">Analytical</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
                ) }
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
                  {isSynthesizing ? 'Synthesizing...' : 'Synthesize'}
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
        {(localReasoning ?? postReasoning) && (
          <div className="rounded-md border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between">
              <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">Reasoning</div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                onClick={async () => {
                  try {
                    setLocalReasoning(null);
                    setLocalHook(null);
                    sessionStorage.setItem(STYLE_CACHE_KEY, "{}");  
                    await clearSynthesis();
                  } catch (error) {
                    console.error('Failed to clear synthesis:', error);
                  }
                }}
                title="Clear synthesis"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-slate-200 text-sm whitespace-pre-wrap">{(localReasoning ?? postReasoning) as string}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostEditor;


