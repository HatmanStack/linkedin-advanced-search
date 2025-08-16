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
  isSynthesizing: boolean;
  researchContent: string | null;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  generateIdeas: (prompt?: string) => Promise<string[]>;
  researchTopics: (topics: string[]) => Promise<void>;
  synthesizeResearch: (contentOverride?: string) => Promise<void>;
  clearResearch: () => void;
  ideas: string[];
  setIdeas: (ideas: string[]) => void;
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
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [researchContent, setResearchContent] = useState<string | null>(null);
  const RESEARCH_STORAGE_KEY = 'ai_research_content';
  const IDEAS_STORAGE_KEY = 'ai_generated_ideas';
  const [ideas, setIdeas] = useState<string[]>([]);

  // Load or clear unsent post content whenever user changes (app start/sign-in/sign-out)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !userProfile) {
        setContent("");
        setResearchContent(null);
        return;
      }
      
      // Use the profile data from context instead of fetching again
      const unsent = (userProfile as any).unpublished_post_content || (userProfile as any).unsent_post_content;
      if (!cancelled) setContent(unsent || "");
      // Load research content from session storage
      try {
        const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
        if (!cancelled && stored) {
          setResearchContent(stored);
        } else {
          const fromProfile = (userProfile as any)?.ai_generated_post_content?.research_content;
          if (!cancelled && typeof fromProfile === 'string' && fromProfile.trim()) {
            setResearchContent(fromProfile);
          }
        }
      } catch {}

      // Load ideas from session storage
      try {
        const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
        if (!cancelled && storedIdeas) {
          setIdeas(JSON.parse(storedIdeas));
        } else {
          const fromProfileIdeas = (userProfile as any)?.ai_generated_post_content?.ideas;
          if (!cancelled && Array.isArray(fromProfileIdeas)) {
            setIdeas(fromProfileIdeas);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user, userProfile]);

  const saveDraft = useCallback(async () => {
    if (!content.trim() || !userProfile) return;
    setIsSaving(true);
    try {
      // Prefer latest values from session storage if present
      let researchForSave = researchContent ?? null;
      try {
        const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
        if (stored && typeof stored === 'string') researchForSave = stored;
      } catch {}
      let ideasForSave: string[] | null = ideas ?? null;
      try {
        const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
        if (storedIdeas) ideasForSave = JSON.parse(storedIdeas);
      } catch {}

      await postsService.saveUnsentPostToProfile(content, userProfile, {
        researchContent: researchForSave,
        ideas: ideasForSave,
      });
      toast({
        title: 'Draft saved',
        description: 'Editor text, research, and ideas saved.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, userProfile, researchContent, ideas, toast]);

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
      // Persist locally in session storage for repopulation across reloads
      try { sessionStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas)); } catch {}
      setIdeas(ideas);
      return ideas;
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [userProfile]);

  const researchTopics = useCallback(async (topics: string[]) => {
    setIsResearching(true);
    try {
      const result = await postsService.researchTopics(topics, userProfile || undefined);
      if (result) setContent(result);
      if (result) {
        setResearchContent(result);
        try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, result); } catch {}
      }
    } finally {
      setIsResearching(false);
    }
  }, [userProfile]);

  const synthesizeResearch = useCallback(async (contentOverride?: string) => {
    const source = (contentOverride ?? content).trim();
    if (!source) return;
    setIsSynthesizing(true);
    try {
      const synthesized = await postsService.synthesizeResearch({
        existing_content: source,
        research_content: researchContent ?? undefined,
      }, userProfile || undefined);
      if (synthesized) setContent(synthesized);
    } finally {
      setIsSynthesizing(false);
    }
  }, [content, researchContent, userProfile]);

  const clearResearch = useCallback(() => {
    setResearchContent(null);
    try { sessionStorage.removeItem(RESEARCH_STORAGE_KEY); } catch {}
  }, []);

  const value = useMemo(
    () => ({
      content,
      setContent,
      isSaving,
      isPublishing,
      isGeneratingIdeas,
      isResearching,
      isSynthesizing,
      researchContent,
      saveDraft,
      publish,
      generateIdeas,
      researchTopics,
      synthesizeResearch,
      clearResearch,
      ideas,
      setIdeas,
    }),
    [content, isSaving, isPublishing, isGeneratingIdeas, isResearching, isSynthesizing, researchContent, ideas, saveDraft, publish, generateIdeas, researchTopics, synthesizeResearch, clearResearch]
  );

  return (
    <PostComposerContext.Provider value={value}>
      {children}
    </PostComposerContext.Provider>
  );
};


