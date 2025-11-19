import { createContext, useContext, type ReactNode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { postsService } from '@/features/posts';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/profile';
import { useToast } from '@/hooks/use-toast';
import { lambdaApiService } from '@/services/lambdaApiService';

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

  // Load or clear unsent post content when user/profile becomes available.
  // Only hydrate editor content once per user session to avoid overwriting local edits on profile refreshes.
  useEffect(() => {
    let cancelled = false;
    console.log('[PostComposer] hydrate start', { hasUser: !!user, hasProfile: !!userProfile });
    
    (async () => {
      if (!user || !userProfile) {
        console.log('[PostComposer] hydrate aborted: missing user/profile');
        setContent("");
        setResearchContent(null);
        hasHydratedContentRef.current = false;
        return;
      }
      
      
      
      // Use the profile data from context instead of fetching again
      const unsent = (userProfile as any).unpublished_post_content || (userProfile as any).unsent_post_content;
      if (!cancelled && !hasHydratedContentRef.current) {
        setContent(unsent || "");
        hasHydratedContentRef.current = true;
      }
      // Mirror profile values into session storage for downstream component hydration
      try {
        const pResearch = (userProfile as any)?.ai_generated_research;
        if (typeof pResearch === 'string' && pResearch.trim()) {
          try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, pResearch); } catch {
            // Ignore storage errors (private browsing, quota exceeded)
          }
        }
      } catch {
        // Ignore profile access errors
      }

      try {
        const pResearch = (userProfile as any)?.unpublished_post_content;
        if (typeof pResearch === 'string' && pResearch.trim()) {
          try { sessionStorage.setItem(CONTENT_STORAGE_KEY, pResearch); } catch {
            // Ignore storage errors (private browsing, quota exceeded)
          }
        }
      } catch {
        // Ignore profile access errors
      }

      try {
        const pReasoning = (userProfile as any)?.ai_generated_post_reasoning;
        if (typeof pReasoning === 'string' && pReasoning.trim()) {
          try { sessionStorage.setItem(REASONING_STORAGE_KEY, pReasoning); } catch {
            // Ignore storage errors (private browsing, quota exceeded)
          }
        }
      } catch {
        // Ignore profile access errors
      }

      try {
        const pHook = (userProfile as any)?.ai_generated_post_hook;
        if (typeof pHook === 'string' && pHook.trim()) {
          try { sessionStorage.setItem(HOOK_STORAGE_KEY, pHook); } catch {
            // Ignore storage errors (private browsing, quota exceeded)
          }
        }
      } catch {
        // Ignore profile access errors
      }

      // Leave ideas hydration as-is; components handle their own session hydration too
      try {
        const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
        console.log('[PostComposer] hydrate ideas: session', { exists: !!storedIdeas, len: storedIdeas?.length });
        
        if (!cancelled && storedIdeas) {
          console.log('[PostComposer] hydrate ideas: using session');
          setIdeas(JSON.parse(storedIdeas));
          
        } else {
          console.log('[PostComposer] hydrate ideas: profile fallback');
          const fromProfileIdeas = (userProfile as any)?.ai_generated_ideas;
          if (!cancelled && Array.isArray(fromProfileIdeas)) {
            console.log('[PostComposer] hydrate ideas: using profile', { count: fromProfileIdeas.length });
            setIdeas(fromProfileIdeas);
          } else {
            console.log('No valid ideas found in userProfile or not an array');
          }
        }
      } catch (error) {
        console.error('Error loading ideas:', error);
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
      // On publish, remove saved unsent content from profile
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
      // Persist locally in session storage for repopulation across reloads
      try {
        sessionStorage.setItem(IDEAS_STORAGE_KEY, JSON.stringify(ideas));
      } catch {
        // Ignore storage errors
      }
      
      setIdeas(ideas);
      return ideas;
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [userProfile]);

  const researchTopics = useCallback(async (topics: string[]) => {
    setIsResearching(true);
    try {
      console.log('[PostComposer] researchTopics: invoking', { topicsCount: topics.length });
      const result = await postsService.researchTopics(topics, userProfile || undefined);
      if (result) {
        console.log('[PostComposer] researchTopics: got result', { len: result.length });
        setResearchContent(result);
        try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, result); console.log('[PostComposer] researchTopics: wrote research to session'); } catch (e) { console.error('[PostComposer] researchTopics: failed writing session', e); }
      }
    } finally {
      console.log('[PostComposer] researchTopics: done');
      setIsResearching(false);
    }
  }, [userProfile]);

  const synthesizeResearch = useCallback(async (contentOverride?: string) => {
    const raw = (contentOverride ?? content) ?? '';
    const source = raw.trim();
    // hydrate selected ideas from session storage
    let selectedIdeas: string[] | undefined;
    try {
      const si = sessionStorage.getItem('ai_selected_ideas');
      if (si) {
        const parsed = JSON.parse(si);
        if (Array.isArray(parsed) && parsed.length > 0) selectedIdeas = parsed;
      }
    } catch {
        // Ignore storage errors
      }


    console.log('[PostComposer] synthesize: start', { sourceLen: source.length, hasResearch: !!researchContent, ideasCount: selectedIdeas?.length || 0 });
    setIsSynthesizing(true);
    try {
      const synthesized = await postsService.synthesizeResearch({
        existing_content: source,
        research_content: researchContent ?? undefined,
        selected_ideas: selectedIdeas,
      }, userProfile || undefined);
      if (synthesized) {
        // Set the main content in the editor
        setContent(synthesized.content);
        try { sessionStorage.setItem(RESEARCH_STORAGE_KEY, synthesized.content); } catch {
        // Ignore storage errors
      }
        
        // Save reasoning and hook to session storage and state
        if (synthesized.reasoning) {
          setPostReasoning(synthesized.reasoning);
          try { sessionStorage.setItem(REASONING_STORAGE_KEY, synthesized.reasoning); } catch {
        // Ignore storage errors
      }
        }
        if (synthesized.hook) {
          setPostHook(synthesized.hook);
          try { sessionStorage.setItem(HOOK_STORAGE_KEY, synthesized.hook); } catch {
        // Ignore storage errors
      }
        }
      }
    } finally {
      setIsSynthesizing(false);
    }
  }, [content, researchContent, userProfile]);

  const clearResearch = useCallback(async () => {
    console.log('[PostComposer] clearResearch');
    setResearchContent(null);
    try { sessionStorage.removeItem(RESEARCH_STORAGE_KEY); } catch {
        // Ignore storage errors
      }
    
    // Update user profile to clear research content
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_research: ''
      });
      console.log('[PostComposer] clearResearch: profile updated');
    } catch (error) {
      console.error('Failed to update profile when clearing research:', error);
    }
  }, []);

  const clearSynthesis = useCallback(async () => {
    console.log('[PostComposer] clearSynthesis');
    setPostReasoning(null);
    setPostHook(null);
    try { 
      sessionStorage.removeItem(REASONING_STORAGE_KEY);
      sessionStorage.removeItem(HOOK_STORAGE_KEY);
    } catch {
        // Ignore storage errors
      }
    
    // Update user profile to clear synthesis content
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_post_reasoning: '',
        ai_generated_post_hook: ''
      });
      console.log('[PostComposer] clearSynthesis: profile updated');
    } catch (error) {
      console.error('Failed to update profile when clearing synthesis:', error);
    }
  }, []);

  const clearIdea = useCallback(async (newIdeas: string[]) => {
    console.log('[PostComposer] clearIdea: new count', newIdeas.length);
    setIdeas(newIdeas);
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_ideas: newIdeas
      });
      console.log('[PostComposer] clearIdea: profile updated');
    } catch (error) {
      console.error('Failed to update profile with new ideas:', error);
    }
  }, []);

  const clearAllIdeas = useCallback(async () => {
    console.log('[PostComposer] clearAllIdeas');
    setIdeas([]);
    try {
      await lambdaApiService.updateUserProfile({
        ai_generated_ideas: []
      });
      console.log('[PostComposer] clearAllIdeas: profile updated');
    } catch (error) {
      console.error('Failed to update profile to clear all ideas:', error);
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



