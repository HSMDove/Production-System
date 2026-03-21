import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { MessageCircle, Users, Trash2, Plus, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { IdeaComment, IdeaAssignment } from "@/lib/types";

interface IdeaCollaborationProps {
  ideaId: string;
}

export function IdeaCollaboration({ ideaId }: IdeaCollaborationProps) {
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [newAssigneeName, setNewAssigneeName] = useState("");
  const [newAssigneeRole, setNewAssigneeRole] = useState("");

  const { data: comments = [], isLoading: commentsLoading } = useQuery<IdeaComment[]>({
    queryKey: ["/api/ideas", ideaId, "comments"],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<IdeaAssignment[]>({
    queryKey: ["/api/ideas", ideaId, "assignments"],
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: { authorName: string; content: string }) => {
      return apiRequest("POST", `/api/ideas/${ideaId}/comments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      setNewComment("");
      toast({ title: "تم إضافة التعليق" });
    },
    onError: () => {
      toast({ title: "فشل إضافة التعليق", variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "comments"] });
      toast({ title: "تم حذف التعليق" });
    },
    onError: () => {
      toast({ title: "فشل حذف التعليق", variant: "destructive" });
    },
  });

  const addAssignmentMutation = useMutation({
    mutationFn: async (data: { assigneeName: string; role?: string }) => {
      return apiRequest("POST", `/api/ideas/${ideaId}/assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "assignments"] });
      setNewAssigneeName("");
      setNewAssigneeRole("");
      toast({ title: "تم إضافة عضو الفريق" });
    },
    onError: () => {
      toast({ title: "فشل إضافة عضو الفريق", variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("DELETE", `/api/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "assignments"] });
      toast({ title: "تم إزالة عضو الفريق" });
    },
    onError: () => {
      toast({ title: "فشل إزالة عضو الفريق", variant: "destructive" });
    },
  });

  const handleAddComment = () => {
    if (!newComment.trim() || !authorName.trim()) return;
    addCommentMutation.mutate({ authorName, content: newComment });
  };

  const handleAddAssignment = () => {
    if (!newAssigneeName.trim()) return;
    addAssignmentMutation.mutate({
      assigneeName: newAssigneeName,
      role: newAssigneeRole || undefined,
    });
  };

  return (
    <Card className="mt-4">
      <Tabs defaultValue="comments" className="w-full">
        <CardHeader className="pb-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="comments" className="gap-2" data-testid="tab-comments">
              <MessageCircle className="h-4 w-4" />
              التعليقات ({comments.length})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2" data-testid="tab-assignments">
              <Users className="h-4 w-4" />
              الفريق ({assignments.length})
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent>
          <TabsContent value="comments" className="m-0">
            <div className="space-y-4">
              <ScrollArea className="h-48">
                {commentsLoading ? (
                  <div className="text-center text-muted-foreground py-4">
                    جارٍ التحميل...
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    لا توجد تعليقات بعد
                  </div>
                ) : (
                  <div className="space-y-3 pl-4">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="group relative rounded-md border p-3"
                        data-testid={`comment-${comment.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {comment.authorName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(comment.createdAt), "PPp", { locale: ar })}
                              </span>
                            </div>
                            <p className="mt-1 text-sm whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            disabled={deleteCommentMutation.isPending}
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator />

              <div className="space-y-2">
                <Input
                  placeholder="اسمك"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  data-testid="input-comment-author"
                />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="اكتب تعليقك..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="resize-none flex-1"
                    rows={2}
                    data-testid="input-comment-content"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || !authorName.trim() || addCommentMutation.isPending}
                    data-testid="button-add-comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="m-0">
            <div className="space-y-4">
              <ScrollArea className="h-48">
                {assignmentsLoading ? (
                  <div className="text-center text-muted-foreground py-4">
                    جارٍ التحميل...
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    لا يوجد أعضاء معينين بعد
                  </div>
                ) : (
                  <div className="space-y-2 pl-4">
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="group flex items-center justify-between gap-2 rounded-md border p-3"
                        data-testid={`assignment-${assignment.id}`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{assignment.assigneeName}</span>
                          {assignment.role && (
                            <Badge variant="secondary" className="text-xs">
                              {assignment.role}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                          disabled={deleteAssignmentMutation.isPending}
                          data-testid={`button-delete-assignment-${assignment.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator />

              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="اسم عضو الفريق"
                  value={newAssigneeName}
                  onChange={(e) => setNewAssigneeName(e.target.value)}
                  className="flex-1 min-w-[120px]"
                  data-testid="input-assignee-name"
                />
                <Input
                  placeholder="الدور (اختياري)"
                  value={newAssigneeRole}
                  onChange={(e) => setNewAssigneeRole(e.target.value)}
                  className="flex-1 min-w-[100px]"
                  data-testid="input-assignee-role"
                />
                <Button
                  size="icon"
                  onClick={handleAddAssignment}
                  disabled={!newAssigneeName.trim() || addAssignmentMutation.isPending}
                  data-testid="button-add-assignment"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
