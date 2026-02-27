import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IdeaCard } from "./idea-card";
import type { IdeaWithFolder, IdeaStatus } from "@/lib/types";
import { ideaStatusLabels, statusColors } from "@/lib/types";

interface KanbanBoardProps {
  ideas: IdeaWithFolder[];
  onEdit: (idea: IdeaWithFolder) => void;
  onDelete: (idea: IdeaWithFolder) => void;
  onInlineUpdate?: (ideaId: string, field: string, value: string) => void;
  onCardClick?: (idea: IdeaWithFolder) => void;
  onStatusChange: (ideaId: string, newStatus: IdeaStatus) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const columns: IdeaStatus[] = [
  "raw_idea",
  "needs_research",
  "ready_for_script",
  "script_in_progress",
  "ready_for_filming",
  "completed",
];

interface KanbanColumnProps {
  status: IdeaStatus;
  ideas: IdeaWithFolder[];
  onEdit: (idea: IdeaWithFolder) => void;
  onDelete: (idea: IdeaWithFolder) => void;
  onInlineUpdate?: (ideaId: string, field: string, value: string) => void;
  onCardClick?: (idea: IdeaWithFolder) => void;
}

function KanbanColumn({ status, ideas, onEdit, onDelete, onInlineUpdate, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const statusColor = statusColors[status] || statusColors.raw_idea;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] max-w-[320px] rounded-lg border bg-card ${
        isOver ? "ring-2 ring-primary" : ""
      }`}
      data-testid={`kanban-column-${status}`}
    >
      <div className="flex items-center justify-between gap-2 p-3 border-b">
        <h3 className="font-medium text-sm">
          {ideaStatusLabels[status]}
        </h3>
        <Badge 
          variant="secondary" 
          className={`${statusColor.bg} ${statusColor.text}`}
        >
          {ideas.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-2 h-[calc(100vh-220px)] min-h-[300px]">
        <SortableContext
          items={ideas.map((idea) => idea.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={onEdit}
                onDelete={onDelete}
                onInlineUpdate={onInlineUpdate}
                onCardClick={onCardClick}
              />
            ))}
          </div>
        </SortableContext>
        {ideas.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            لا توجد أفكار
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function KanbanBoard({
  ideas,
  onEdit,
  onDelete,
  onInlineUpdate,
  onCardClick,
  onStatusChange,
  activeId,
  setActiveId,
}: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const ideasByStatus = useMemo(() => {
    const grouped: Record<IdeaStatus, IdeaWithFolder[]> = {
      raw_idea: [],
      needs_research: [],
      ready_for_script: [],
      script_in_progress: [],
      ready_for_filming: [],
      completed: [],
    };

    ideas.forEach((idea) => {
      if (grouped[idea.status]) {
        grouped[idea.status].push(idea);
      }
    });

    return grouped;
  }, [ideas]);

  const activeIdea = useMemo(
    () => ideas.find((idea) => idea.id === activeId),
    [ideas, activeId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdea = ideas.find((idea) => idea.id === active.id);
    if (!activeIdea) return;

    const overId = over.id as string;
    
    // Check if dropped on a column
    if (columns.includes(overId as IdeaStatus)) {
      if (activeIdea.status !== overId) {
        onStatusChange(activeIdea.id, overId as IdeaStatus);
      }
      return;
    }

    // Check if dropped on another idea
    const overIdea = ideas.find((idea) => idea.id === overId);
    if (overIdea && activeIdea.status !== overIdea.status) {
      onStatusChange(activeIdea.id, overIdea.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            ideas={ideasByStatus[status]}
            onEdit={onEdit}
            onDelete={onDelete}
            onInlineUpdate={onInlineUpdate}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIdea && (
          <IdeaCard
            idea={activeIdea}
            onEdit={() => {}}
            onDelete={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
