import { createContext, useContext, type ReactNode, useState, useCallback, useMemo, useEffect } from 'react';
import { postsService } from '../services/postsService';
import { useAuth } from './AuthContext';
import { useUserProfile } from './UserProfileContext';
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
  generateIdeas: (prompt?: string) => Promise<string[]>;
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
  const { userProfile } = useUserProfile();
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
      if (!user || !userProfile) {
        setContent("");
        return;
      }
      
      // Use the profile data from context instead of fetching again
      const unsent = userProfile.unsent_post_content;
      if (!cancelled) setContent(unsent || "");
    })();
    return () => { cancelled = true; };
  }, [user, userProfile]);

  const saveDraft = useCallback(async () => {
    if (!content.trim() || !userProfile) return;
    setIsSaving(true);
    try {
      await postsService.saveUnsentPostToProfile(content, userProfile);
      toast({
        title: 'Draft saved',
        description: 'Only text content was saved. Images or media are not saved.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, userProfile, toast]);

  const publish = useCallback(async () => {
    if (!content.trim() || !userProfile) return;
    setIsPublishing(true);
    try {
      await postsService.publishPost(content);
      // On publish, remove saved unsent content from profile
      await postsService.clearUnsentPostFromProfile(userProfile);
      setContent('');
    } finally {
      setIsPublishing(false);
    }
  }, [content, userProfile]);

  const generateIdeas = useCallback(async (prompt?: string): Promise<string[]> => {
    setIsGeneratingIdeas(true);
    try {
      const ideas = await postsService.generateIdeas(prompt, userProfile || undefined);
      // Do not modify editor content here; return ideas for the assistant list
      return ideas;
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [userProfile]);

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


