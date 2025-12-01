import { createContext, useContext, type ReactNode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { postsService } from '@/features/posts';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/profile';
import { useToast } from '@/shared/hooks';
import { lambdaApiService } from '@/shared/services';
import { createLogger } from '@/shared/utils/logger';

const logger = createLogger('PostComposer');

interface PostComposerContextValue {
  content: string;
  setContent: (content: string) => void;
  isSaving: boolean;
  isPublishing: boolean;
  isGeneratingIdeas: boolean;
  isResearching: boolean;
  isSynthesizing: boolean;
  researchContent: string | null;
  postReasoning: string | null;
  postHook: string | null;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  generateIdeas: (prompt?: string) => Promise<string[]>;
  researchTopics: (topics: string[]) => Promise<void>;
  synthesizeResearch: (contentOverride?: string) => Promise<void>;
  clearResearch: () => Promise<void>;
  clearSynthesis: () => Promise<void>;
  clearIdea: (newIdeas: string[]) => Promise<void>;
  clearAllIdeas: () => Promise<void>;
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
  const hasHydratedContentRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [researchContent, setResearchContent] = useState<string | null>(null);
  const [postReasoning, setPostReasoning] = useState<string | null>(null);
  const [postHook, setPostHook] = useState<string | null>(null);
  const CONTENT_STORAGE_KEY = 'post_editor_content';
  const RESEARCH_STORAGE_KEY = 'ai_research_content';
  const IDEAS_STORAGE_KEY = 'ai_generated_ideas';
  const REASONING_STORAGE_KEY = 'ai_generated_post_reasoning';
  const HOOK_STORAGE_KEY = 'ai_generated_post_hook';
  const [ideas, setIdeas] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    logger.debug('hydrate start', { hasUser: !!user, hasProfile: !!userProfile });

    (async () => {
      if (!user || !userProfile) {
        logger.debug('hydrate aborted: missing user/profile');
        setContent("");
        setResearchContent(null);
        hasHydratedContentRef.current = false;
        return;
      }
      
      
      const unsent = userProfile.unpublished_post_content;
      if (!cancelled && !hasHydratedContentRef.current) {
        setContent(unsent || "");
        hasHydratedContentRef.current = true;
      }
      try {
        const pResearch = userProfile.ai_generated_research;
        if (typeof pResearch === 'string' && pResearch.trim()) {
          try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, pResearch); } catch { /* ignored */ }
        }
      } catch { /* ignored */ }

      try {
        const pContent = userProfile.unpublished_post_content;
        if (typeof pContent === 'string' && pContent.trim()) {
          try { sessionStorage.setItem(CONTENT_STORAGE_KEY, pContent); } catch { /* ignored */ }
        }
      } catch { /* ignored */ }

      try {
        const pReasoning = userProfile.ai_generated_post_reasoning;
        if (typeof pReasoning === 'string' && pReasoning.trim()) {
          try { sessionStorage.setItem(REASONING_STORAGE_KEY, pReasoning); } catch { /* ignored */ }
        }
      } catch { /* ignored */ }

      try {
        const pHook = userProfile.ai_generated_post_hook;
        if (typeof pHook === 'string' && pHook.trim()) {
          try { sessionStorage.setItem(HOOK_STORAGE_KEY, pHook); } catch { /* ignored */ }
        }
      } catch { /* ignored */ }

      try {
        const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
        logger.debug('hydrate ideas: session', { exists: !!storedIdeas, len: storedIdeas?.length });

        if (!cancelled && storedIdeas) {
          logger.debug('hydrate ideas: using session');
          setIdeas(JSON.parse(storedIdeas));

        } else {
          logger.debug('hydrate ideas: profile fallback');
          const fromProfileIdeas = userProfile.ai_generated_ideas;
          if (!cancelled && Array.isArray(fromProfileIdeas)) {
            logger.debug('hydrate ideas: using profile', { count: fromProfileIdeas.length });
            setIdeas(fromProfileIdeas);
          } else {
            logger.debug('No valid ideas found in userProfile or not an array');
          }
        }
      } catch (error) {
        logger.error('Error loading ideas', { error });
      }
    })();
    return () => { cancelled = true; };
  }, [user, userProfile]);

  const saveDraft = useCallback(async () => {
   
    if (!content.trim()) return;
    setIsSaving(true);
    try {
      await postsService.saveUnsentPostToProfile(content);
      toast({
        title: 'Draft saved',
        description: 'Editor text saved.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, toast]);

  const publish = useCallback(async () => {
    if (!content.trim() || !userProfile) return;
    setIsPublishing(true);
    try {
      await postsService.publishPost(content);
      await postsService.clearUnsentPostFromProfile();
      setContent('');
    } finally {
      setIsPublishing(false);
    }
  }, [content, userProfile]);

  const generateIdeas = useCallback(async (prompt?: string): Promise<string[]> => {
    setIsGeneratingIdeas(true);
    try {
      const ideas = await postsService.generateIdeas(prompt, userProfile || undefined);
      try {
        sessionStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
      } catch { /* ignored */ }

      setIdeas(ideas);
      return ideas;
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [userProfile]);

  const researchTopics = useCallback(async (topics: string[]) => {
    setIsResearching(true);
    try {
      logger.debug('researchTopics: invoking', { topicsCount: topics.length });
      const result = await postsService.researchTopics(topics, userProfile || undefined);
      if (result) {
        logger.debug('researchTopics: got result', { len: result.length });
        setResearchContent(result);
        try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, result); logger.debug('researchTopics: wrote research to session'); } catch (e) { logger.error('researchTopics: failed writing session', { error: e }); }
      }
    } finally {
      logger.debug('researchTopics: done');
      setIsResearching(false);
    }
  }, [userProfile]);

  const synthesizeResearch = useCallback(async (contentOverride?: string) => {
    const raw = (contentOverride ?? content) ?? '';
    const source = raw.trim();
    let selectedIdeas: string[] | undefined;
    try {
      const si = sessionStorage.getItem('ai_selected_ideas');
      if (si) {
        const parsed = JSON.parse(si);
        if (Array.isArray(parsed) && parsed.length > 0) selectedIdeas = parsed;
      }
    } catch { /* ignored */ }

    logger.debug('synthesize: start', { sourceLen: source.length, hasResearch: !!researchContent, ideasCount: selectedIdeas?.length || 0 });
    setIsSynthesizing(true);
    try {
      const synthesized = await postsService.synthesizeResearch({
        existing_content: source,
        research_content: researchContent ?? undefined,
        selected_ideas: selectedIdeas,
      }, userProfile || undefined);
      if (synthesized) {
        setContent(synthesized.content);
        try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, synthesized.content); } catch { /* ignored */ }

        if (synthesized.reasoning) {
          setPostReasoning(synthesized.reasoning);
          try { sessionStorage.setItem(REASONING_STORAGE_KEY, synthesized.reasoning); } catch { /* ignored */ }
        }
        if (synthesized.hook) {
          setPostHook(synthesized.hook);
          try { sessionStorage.setItem(HOOK_STORAGE_KEY, synthesized.hook); } catch { /* ignored */ }
        }
      }
    } finally {
      setIsSynthesizing(false);
    }
  }, [content, researchContent, userProfile]);

  const clearResearch = useCallback(async () => {
    logger.debug('clearResearch');
    setResearchContent(null);
    try { sessionStorage.removeItem(RESEARCH_STORAGE_KEY); } catch { /* ignored */ }

    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_research: ''
      });
      logger.debug('clearResearch: profile updated');
    } catch (error) {
      logger.error('Failed to update profile when clearing research', { error });
    }
  }, []);

  const clearSynthesis = useCallback(async () => {
    logger.debug('clearSynthesis');
    setPostReasoning(null);
    setPostHook(null);
    try {
      sessionStorage.removeItem(REASONING_STORAGE_KEY);
      sessionStorage.removeItem(HOOK_STORAGE_KEY);
    } catch { /* ignored */ }

    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_post_reasoning: '',
        ai_generated_post_hook: ''
      });
      logger.debug('clearSynthesis: profile updated');
    } catch (error) {
      logger.error('Failed to update profile when clearing synthesis', { error });
    }
  }, []);

  const clearIdea = useCallback(async (newIdeas: string[]) => {
    logger.debug('clearIdea: new count', { count: newIdeas.length });
    setIdeas(newIdeas);
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_ideas: newIdeas
      });
      logger.debug('clearIdea: profile updated');
    } catch (error) {
      logger.error('Failed to update profile with new ideas', { error });
    }
  }, []);

  const clearAllIdeas = useCallback(async () => {
    logger.debug('clearAllIdeas');
    setIdeas([]);
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_ideas: []
      });
      logger.debug('clearAllIdeas: profile updated');
    } catch (error) {
      logger.error('Failed to update profile to clear all ideas', { error });
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
      isSynthesizing,
      researchContent,
      postReasoning,
      postHook,
      saveDraft,
      publish,
      generateIdeas,
      researchTopics,
      synthesizeResearch,
      clearResearch,
      clearSynthesis,
      clearIdea,
      clearAllIdeas,
      ideas,
      setIdeas,
    }),
    [content, isSaving, isPublishing, isGeneratingIdeas, isResearching, isSynthesizing, researchContent, postReasoning, postHook, ideas, saveDraft, publish, generateIdeas, researchTopics, synthesizeResearch, clearResearch, clearSynthesis, clearIdea, clearAllIdeas]
  );

  return (
    <PostComposerContext.Provider value={value}>
      {children}
    </PostComposerContext.Provider>
  );
};

