import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { postsService } from '../services/postsService';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/use-toast';

interface PostComposerContextValue {
  content: string;
  setContent: (content: string) => void;
  isSaving: boolean;
  isPublishing: boolean;
  isGeneratingIdeas: boolean;
  isResearching: boolean;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  generateIdeas: () => Promise<void>;
  researchTopics: (query: string) => Promise<void>;
}

const PostComposerContext = createContext<PostComposerContextValue | undefined>(undefined);

export const usePostComposer = (): PostComposerContextValue => {
  const ctx = useContext(PostComposerContext);
  if (!ctx) throw new Error('usePostComposer must be used within PostComposerProvider');
  return ctx;
};

export const PostComposerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isResearching, setIsResearching] = useState(false);

  // Load or clear unsent post content whenever user changes (app start/sign-in/sign-out)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        setContent("");
        return;
      }
      try {
        const profileResp = await postsService.fetchUserProfile();
        const unsent = (profileResp && (profileResp as any).unsent_post_content) as string | undefined;
        if (!cancelled) setContent(unsent || "");
      } catch (err) {
        if (!cancelled) setContent("");
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const saveDraft = useCallback(async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await postsService.saveUnsentPostToProfile(content);
      toast({
        title: 'Draft saved',
        description: 'Only text content was saved. Images or media are not saved.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [content]);

  const publish = useCallback(async () => {
    if (!content.trim()) return;
    setIsPublishing(true);
    try {
      await postsService.publishPost(content);
      // On publish, remove saved unsent content from profile
      await postsService.clearUnsentPostFromProfile();
      setContent('');
    } finally {
      setIsPublishing(false);
    }
  }, [content, user]);

  const generateIdeas = useCallback(async () => {
    setIsGeneratingIdeas(true);
    try {
      const idea = await postsService.generateIdeas(user);
      setContent(idea);
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [user]);

  const researchTopics = useCallback(async (query: string) => {
    setIsResearching(true);
    try {
      const result = await postsService.researchTopics(query);
      if (result) setContent(result);
    } finally {
      setIsResearching(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      content,
      setContent,
      isSaving,
      isPublishing,
      isGeneratingIdeas,
      isResearching,
      saveDraft,
      publish,
      generateIdeas,
      researchTopics,
    }),
    [content, isSaving, isPublishing, isGeneratingIdeas, isResearching, saveDraft, publish, generateIdeas, researchTopics]
  );

  return (
    <PostComposerContext.Provider value={value}>
      {children}
    </PostComposerContext.Provider>
  );
};


