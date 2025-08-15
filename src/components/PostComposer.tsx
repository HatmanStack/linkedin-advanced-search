import PostEditor from './PostEditor';
import PostAIAssistant from './PostAIAssistant';
import { PostComposerProvider, usePostComposer } from '../contexts/PostComposerContext';
import { useState } from 'react';
import { postsService } from '../services/postsService';
import { useToast } from '../hooks/use-toast';
import { useUserProfile } from '../contexts/UserProfileContext';

const PostComposerInner = () => {
  const {
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
  } = usePostComposer();

  const { toast } = useToast();
  const { userProfile } = useUserProfile();
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

  const handleResearchSelectedIdeas = async (selectedIdeas: string[]) => {
    try {
      const researchContent = await postsService.researchSelectedIdeas(selectedIdeas, userProfile || undefined);
      setContent(researchContent);
      
      toast({
        title: 'Research Complete',
        description: `Successfully researched ${selectedIdeas.length} selected topics.`,
      });
    } catch (error) {
      console.error('Failed to research selected ideas:', error);
      toast({
        title: 'Research Failed',
        description: 'Failed to research selected ideas. Please try again.',
        variant: 'destructive',
      });
    }
  };

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
        />
      </div>

      <div className="space-y-6">
        <PostAIAssistant
          onGenerateIdeas={handleGenerateIdeas}
          onResearchTopics={researchTopics}
          onResearchSelectedIdeas={handleResearchSelectedIdeas}
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


