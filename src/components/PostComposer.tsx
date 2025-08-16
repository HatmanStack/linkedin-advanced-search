import PostEditor from './PostEditor';
import PostAIAssistant from './PostAIAssistant';
import ResearchResultsCard from './ResearchResultsCard';
import { usePostComposer } from '../contexts/PostComposerContext';
import { useState } from 'react';
import { useToast } from '../hooks/use-toast';

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
  } = usePostComposer();

  const { toast } = useToast();
  const [ideas, setIdeas] = useState<string[]>([]);

  const handleGenerateIdeas = async (prompt?: string) => {
    try {
      const generatedIdeas = await generateIdeas(prompt);
      setIdeas(generatedIdeas);
    } catch (error) {
      console.error('Failed to generate ideas:', error);
      // Ideas will remain empty, so textarea will be shown
    }
  };

  const handleClearIdeas = () => {
    setIdeas([]);
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
          onSynthesizeResearch={researchContent ? () => synthesizeResearch() : undefined}
        />

        <ResearchResultsCard
          isResearching={isResearching}
          researchContent={researchContent}
          onClear={clearResearch}
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
          onClearIdeas={handleClearIdeas}
        />
      </div>
    </div>
  );
};

const PostComposer = () => {
  return <PostComposerInner />;
};

export default PostComposer;


