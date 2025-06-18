import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2 } from 'lucide-react';

interface SavedPost {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface SavedPostsListProps {
  posts: SavedPost[];
  onLoadPost: (post: SavedPost) => void;
  onDeletePost: (postId: string) => void;
}

const SavedPostsList = ({ posts, onLoadPost, onDeletePost }: SavedPostsListProps) => {
  if (posts.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white/5 backdrop-blur-md border-white/10 mt-6">
      <CardHeader>
        <CardTitle className="text-white">Saved Drafts</CardTitle>
        <CardDescription className="text-slate-300">
          Click on a draft to load it into the editor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {posts.map((post) => (
              <div 
                key={post.id} 
                className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => onLoadPost(post)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-sm mb-1">{post.title}</h4>
                    <p className="text-slate-400 text-xs">
                      Created: {new Date(post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white p-1 h-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePost(post.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default SavedPostsList;
