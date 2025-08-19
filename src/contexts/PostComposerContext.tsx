import { createContext, useContext, type ReactNode, useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  postReasoning: string | null;
  postHook: string | null;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  generateIdeas: (prompt?: string) => Promise<string[]>;
  researchTopics: (topics: string[]) => Promise<void>;
  synthesizeResearch: (contentOverride?: string) => Promise<void>;
  clearResearch: () => void;
  clearIdeas: () => void;
  clearSynthesis: () => void;
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
  const RESEARCH_STORAGE_KEY = 'ai_research_content';
  const IDEAS_STORAGE_KEY = 'ai_generated_ideas';
  const REASONING_STORAGE_KEY = 'ai_generated_post_reasoning';
  const HOOK_STORAGE_KEY = 'ai_generated_post_hook';
  const [ideas, setIdeas] = useState<string[]>([]);

  // Load or clear unsent post content when user/profile becomes available.
  // Only hydrate editor content once per user session to avoid overwriting local edits on profile refreshes.
  useEffect(() => {
    let cancelled = false;
    console.log('PostComposer useEffect triggered with:', { user: !!user, userProfile: !!userProfile });
    (async () => {
      if (!user || !userProfile) {
        console.log('Missing user or userProfile, returning early');
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
      // Load research content from session storage
      try {
        const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
        if (!cancelled && stored) {
          setResearchContent(stored);
        } else {
          const fromProfile = (userProfile as any)?.ai_generated_research;
          if (!cancelled && typeof fromProfile === 'string' && fromProfile.trim()) {
            setResearchContent(fromProfile);
          }
        }
      } catch {}

      // Load ideas from session storage
      try {
        const storedIdeas = sessionStorage.getItem(IDEAS_STORAGE_KEY);
        console.log('Stored ideas from session:', storedIdeas);
        if (!cancelled && storedIdeas) {
          setIdeas(JSON.parse(storedIdeas));
          console.log('Loaded ideas from session storage');
        } else {
         
          const fromProfileIdeas = (userProfile as any)?.ai_generated_ideas;
          if (!cancelled && Array.isArray(fromProfileIdeas)) {
            
            setIdeas(fromProfileIdeas);
          } else {
            console.log('No valid ideas found in userProfile or not an array');
          }
        }
      } catch (error) {
        console.error('Error loading ideas:', error);
      }

      // Load reasoning from session storage
      try {
        const storedReasoning = sessionStorage.getItem(REASONING_STORAGE_KEY);
        if (!cancelled && storedReasoning) {
          setPostReasoning(storedReasoning);
        } else {
          const fromProfileReasoning = (userProfile as any)?.ai_generated_post_reasoning;
          if (!cancelled && typeof fromProfileReasoning === 'string' && fromProfileReasoning.trim()) {
            setPostReasoning(fromProfileReasoning);
          }
        }
      } catch (error) {
        console.error('Error loading reasoning:', error);
      }

      // Load hook from session storage
      try {
        const storedHook = sessionStorage.getItem(HOOK_STORAGE_KEY);
        if (!cancelled && storedHook) {
          setPostHook(storedHook);
        } else {
          const fromProfileHook = (userProfile as any)?.ai_generated_post_hook;
          if (!cancelled && typeof fromProfileHook === 'string' && fromProfileHook.trim()) {
            setPostHook(fromProfileHook);
          }
        }
      } catch (error) {
        console.error('Error loading hook:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [user, userProfile]);

  const saveDraft = useCallback(async () => {
    console.log('saveDraft clicked with content length:', content.length);
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
      if (synthesized) {
        // Set the main content in the editor
        setContent(synthesized.content);
        
        // Save reasoning and hook to session storage and state
        if (synthesized.reasoning) {
          setPostReasoning(synthesized.reasoning);
          try { sessionStorage.setItem(REASONING_STORAGE_KEY, synthesized.reasoning); } catch {}
        }
        if (synthesized.hook) {
          setPostHook(synthesized.hook);
          try { sessionStorage.setItem(HOOK_STORAGE_KEY, synthesized.hook); } catch {}
        }
      }
    } finally {
      setIsSynthesizing(false);
    }
  }, [content, researchContent, userProfile]);

  const clearResearch = useCallback(() => {
    setResearchContent(null);
    try { sessionStorage.removeItem(RESEARCH_STORAGE_KEY); } catch {}
  }, []);

  const clearIdeas = useCallback(() => {
    setIdeas([]);
    try { sessionStorage.removeItem(IDEAS_STORAGE_KEY); } catch {}
  }, []);

  const clearSynthesis = useCallback(() => {
    setPostReasoning(null);
    setPostHook(null);
    try { 
      sessionStorage.removeItem(REASONING_STORAGE_KEY);
      sessionStorage.removeItem(HOOK_STORAGE_KEY);
    } catch {}
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
      clearIdeas,
      clearSynthesis,
      ideas,
      setIdeas,
    }),
    [content, isSaving, isPublishing, isGeneratingIdeas, isResearching, isSynthesizing, researchContent, postReasoning, postHook, ideas, saveDraft, publish, generateIdeas, researchTopics, synthesizeResearch, clearResearch, clearIdeas, clearSynthesis]
  );

  return (
    <PostComposerContext.Provider value={value}>
      {children}
    </PostComposerContext.Provider>
  );
};



