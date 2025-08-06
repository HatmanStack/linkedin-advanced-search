import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Save, Send } from 'lucide-react';

interface PostCreatorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSaveDraft: () => void;
  onPublishPost: () => void;
  isSavingDraft: boolean;
  isPublishing: boolean;
}

const PostCreator = ({
  content,
  onContentChange,
  onSaveDraft,
  onPublishPost,
  isSavingDraft,
  isPublishing
}: PostCreatorProps) => {
  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Create LinkedIn Post
        </CardTitle>
        <CardDescription className="text-slate-300">
          Compose engaging content for your LinkedIn audience.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="What's on your mind? Share insights, experiences, or industry thoughts..."
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          className="bg-white/5 border-white/20 text-white placeholder-slate-400 min-h-[200px]"
        />
        <div className="flex justify-between items-center">
          <span className="text-slate-400 text-sm">
            {content.length}/3000 characters
          </span>
          <div className="space-x-2">
            <Button
              className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600 hover:border-slate-500"
              onClick={onSaveDraft}
              disabled={isSavingDraft}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              disabled={!content.trim() || isPublishing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              onClick={onPublishPost}
            >
              <Send className="h-4 w-4 mr-2" />
              {isPublishing ? 'Publishing...' : 'Publish Post'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCreator;
