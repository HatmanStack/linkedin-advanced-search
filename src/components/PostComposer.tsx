import PostEditor from './PostEditor';
import PostAIAssistant from './PostAIAssistant';
import ResearchResultsCard from './ResearchResultsCard';
import { usePostComposer } from '../contexts/PostComposerContext';
import { useEffect, useState } from 'react';
import { useToast } from '../hooks/use-toast';

const RESEARCH_STORAGE_KEY = 'ai_research_content';

const PostComposerInner = () => {
  const {
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
    clearIdea,
    ideas,
    setIdeas,
  } = usePostComposer();

  const { toast } = useToast();
  const [hasSessionResearch, setHasSessionResearch] = useState<boolean>(false);

  // Hydrate local flag from session storage so Synthesize is available after refresh
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
      setHasSessionResearch(Boolean(stored && stored.trim()));
    } catch {
      setHasSessionResearch(false);
    }
  }, []);

  // Keep flag in sync when researchContent changes
  useEffect(() => {
    if (researchContent && researchContent.trim()) {
      setHasSessionResearch(true);
    } else {
      try {
        const stored = sessionStorage.getItem(RESEARCH_STORAGE_KEY);
        setHasSessionResearch(Boolean(stored && stored.trim()));
      } catch {
        setHasSessionResearch(false);
      }
    }
  }, [researchContent]);

  const handleGenerateIdeas = async (prompt?: string) => {
    try {
      const generatedIdeas = await generateIdeas(prompt);
      setIdeas(generatedIdeas);
    } catch (error) {
      console.error('Failed to generate ideas:', error);
      // Ideas will remain empty, so textarea will be shown
    }
  };

  const handleClearResearch = async () => {
    try {
      await clearResearch();
    } catch (error) {
      console.error('Failed to clear research:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear research. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleIdeasUpdate = async (newIdeas: string[]) => {
    try {
      await clearIdea(newIdeas);
    } catch (error) {
      console.error('Failed to update ideas:', error);
      toast({
        title: 'Error',
        description: 'Failed to update ideas. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleValidationError = (message: string) => {
    toast({
      title: 'No Ideas Selected',
      description: message,
      variant: 'destructive',
    });
  };

  // Research of selected ideas is handled via onResearchTopics with a string[] from the assistant

  return (
    <div className="grid lg:grid-cols-[13fr_7fr] gap-8">
      <div className="space-y-6">
        <PostEditor
          content={content}
          onContentChange={setContent}
          onSaveDraft={saveDraft}
          onPublishPost={publish}
          isSavingDraft={isSaving}
          isPublishing={isPublishing}
          isSynthesizing={isSynthesizing}
          onSynthesizeResearch={() => synthesizeResearch()}
        />

        <ResearchResultsCard
          isResearching={isResearching}
          onClear={handleClearResearch}
        />
      </div>

      <div className="space-y-6">
        <PostAIAssistant
          onGenerateIdeas={handleGenerateIdeas}
          onResearchTopics={researchTopics}
          onValidationError={handleValidationError}
          isGeneratingIdeas={isGeneratingIdeas}
          isResearching={isResearching}
          ideas={ideas}
          onIdeasUpdate={handleIdeasUpdate}
        />
      </div>
    </div>
  );
};

const PostComposer = () => {
  return <PostComposerInner />;
};

export default PostComposer;


