import PostEditor from './PostEditor';
import PostAIAssistant from './PostAIAssistant';
import { usePostComposer } from '../contexts/PostComposerContext';

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
          onGenerateIdeas={generateIdeas}
          onResearchTopics={researchTopics}
          isGeneratingIdeas={isGeneratingIdeas}
          isResearching={isResearching}
        />
      </div>
    </div>
  );
};

const PostComposer = () => {
  return <PostComposerInner />;
};

export default PostComposer;


