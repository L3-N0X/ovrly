import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClipboardCopy, CopyPlus, ExternalLink, MoreHorizontal, Trash2, Users } from "lucide-react";

interface Element {
  id: string;
  name: string;
  type: string;
  style?: Record<string, unknown>;
}

interface Overlay {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  elements: Element[];
  createdAt: string;
}

interface User {
  id: string;
  name: string;
}

interface OverlayCardProps {
  overlay: Overlay;
  user: { user: User };
  navigate: (path: string) => void;
  handleCopyPublicUrl: (id: string) => void;
  handleDuplicateOverlay: (id: string) => void;
  handleDeleteOverlay: (id: string) => void;
  copiedId: string | null;
}

const OverlayCard: React.FC<OverlayCardProps> = ({
  overlay,
  user,
  navigate,
  handleCopyPublicUrl,
  handleDuplicateOverlay,
  handleDeleteOverlay,
  copiedId,
}) => {
  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-start justify-start gap-2">
          <span className="truncate pr-2 text-lg">{overlay.name}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="ml-auto">
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/overlay/${overlay.id}`)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                <span>Open Editor</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyPublicUrl(overlay.id)}>
                <ClipboardCopy className="mr-2 h-4 w-4" />
                <span>{copiedId === overlay.id ? "Copied!" : "Copy public URL"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicateOverlay(overlay.id)}>
                <CopyPlus className="mr-2 h-4 w-4" />
                <span>Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => handleDeleteOverlay(overlay.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => navigate(`/overlay/${overlay.id}`)} variant="outline">
            Edit
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        {overlay.description && (
          <CardDescription className="pt-1">{overlay.description}</CardDescription>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            {overlay.userId !== user.user.id && (
              <div className="flex items-center mr-4" title="Shared with you">
                <Users className="h-4 w-4 mr-1" />
                <span>Shared</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Created on {new Date(overlay.createdAt).toLocaleDateString()}
        </p>
      </CardFooter>
    </Card>
  );
};

export default OverlayCard;
