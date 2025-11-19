import PostEditor from '@/features/posts';
import PostAIAssistant from '@/features/posts';
import ResearchResultsCard from '@/components/ResearchResultsCard';
import { usePostComposer } from '@/features/posts';
import { useToast } from '@/hooks/use-toast';

const NewPostTabInner = () => {
  const {
    content,
    setContent,
    isSaving,
    isPublishing,
    isGeneratingIdeas,
    isResearching,
    isSynthesizing,
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

const NewPostTab = () => {
  return <NewPostTabInner />;
};

export default NewPostTab;