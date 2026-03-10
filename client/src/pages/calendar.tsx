import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { ChevronRight, ChevronLeft, CalendarDays, Plus, Clock, Lightbulb } from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IdeaDialog } from "@/components/ideas/idea-dialog";
import { DeleteDialog } from "@/components/common/delete-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { IdeaWithFolder, Folder } from "@/lib/types";
import { ideaCategoryLabels, categoryColors } from "@/lib/types";

type ViewMode = "month" | "week";

const WEEKDAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default function ContentCalendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<IdeaWithFolder | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draggedIdea, setDraggedIdea] = useState<IdeaWithFolder | null>(null);

  const { data: ideas, isLoading: ideasLoading } = useQuery<IdeaWithFolder[]>({
    queryKey: ["/api/ideas"],
  });

  const { data: folders } = useQuery<Folder[]>({
    queryKey: ["/api/folders"],
  });

  const scheduledIdeas = useMemo(() => {
    if (!ideas) return [];
    return ideas.filter(idea => idea.scheduledDate);
  }, [ideas]);

  const unscheduledIdeas = useMemo(() => {
    if (!ideas) return [];
    return ideas.filter(idea => !idea.scheduledDate);
  }, [ideas]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 6 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 6 });

    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 6 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [currentDate]);

  const getIdeasForDate = (date: Date) => {
    return scheduledIdeas.filter(idea => {
      if (!idea.scheduledDate) return false;
      const scheduledDate = typeof idea.scheduledDate === 'string' 
        ? parseISO(idea.scheduledDate)
        : new Date(idea.scheduledDate);
      return isSameDay(scheduledDate, date);
    });
  };

  const updateIdeaMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & any) => {
      return apiRequest("PATCH", `/api/ideas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setIdeaDialogOpen(false);
      setSelectedIdea(null);
      toast({ title: "تم تحديث الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في تحديث الفكرة", variant: "destructive" });
    },
  });

  const createIdeaMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/ideas", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setIdeaDialogOpen(false);
      setSelectedDate(null);
      toast({ title: "تم إضافة الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في إضافة الفكرة", variant: "destructive" });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ideas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      setDeleteDialogOpen(false);
      setSelectedIdea(null);
      toast({ title: "تم حذف الفكرة بنجاح" });
    },
    onError: () => {
      toast({ title: "حدث خطأ", description: "فشل في حذف الفكرة", variant: "destructive" });
    },
  });

  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -7));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 7));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedIdea(null);
    setIdeaDialogOpen(true);
  };

  const handleEditIdea = (idea: IdeaWithFolder) => {
    setSelectedIdea(idea);
    setSelectedDate(null);
    setIdeaDialogOpen(true);
  };

  const handleDeleteIdea = (idea: IdeaWithFolder) => {
    setSelectedIdea(idea);
    setDeleteDialogOpen(true);
  };

  const handleIdeaSubmit = (values: any) => {
    if (selectedIdea) {
      updateIdeaMutation.mutate({ id: selectedIdea.id, ...values });
    } else {
      createIdeaMutation.mutate({
        ...values,
        scheduledDate: selectedDate ? selectedDate.toISOString() : values.scheduledDate,
      });
    }
  };

  const handleDragStart = (idea: IdeaWithFolder) => {
    setDraggedIdea(idea);
  };

  const handleDragEnd = () => {
    setDraggedIdea(null);
  };

  const handleDrop = (date: Date) => {
    if (draggedIdea) {
      updateIdeaMutation.mutate({
        id: draggedIdea.id,
        scheduledDate: date.toISOString(),
      });
      setDraggedIdea(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderIdeaCard = (idea: IdeaWithFolder, compact = false) => {
    const colors = categoryColors[idea.category] || categoryColors.other;
    
    return (
      <div
        key={idea.id}
        draggable
        onDragStart={() => handleDragStart(idea)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          handleEditIdea(idea);
        }}
        className={cn(
          "cursor-pointer rounded-md p-2 text-sm hover-elevate active-elevate-2",
          colors.bg,
          colors.text,
          compact ? "p-1" : "p-2"
        )}
        data-testid={`calendar-idea-${idea.id}`}
      >
        <div className="line-clamp-2 font-medium">
          {idea.title}
        </div>
        {!compact && idea.estimatedDuration && (
          <div className="mt-1 flex items-center gap-1 text-xs opacity-75">
            <Clock className="h-3 w-3" />
            {idea.estimatedDuration}
          </div>
        )}
      </div>
    );
  };

  const renderDayCell = (date: Date, isWeekView = false) => {
    const dayIdeas = getIdeasForDate(date);
    const isCurrentMonth = isSameMonth(date, currentDate);
    const isCurrentDay = isToday(date);
    
    return (
      <div
        key={date.toISOString()}
        className={cn(
          "border-l border-t p-1 transition-colors",
          isWeekView ? "min-h-[200px]" : "min-h-[100px]",
          !isCurrentMonth && "bg-muted/30",
          isCurrentDay && "bg-primary/5",
          draggedIdea && "hover:bg-primary/10"
        )}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(date)}
        onClick={() => handleDayClick(date)}
        data-testid={`calendar-day-${format(date, "yyyy-MM-dd")}`}
      >
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-sm",
              isCurrentDay && "bg-primary text-primary-foreground",
              !isCurrentMonth && "text-muted-foreground"
            )}
          >
            {format(date, "d")}
          </span>
          {dayIdeas.length > 0 && !isWeekView && (
            <Badge variant="secondary" className="text-xs">
              {dayIdeas.length}
            </Badge>
          )}
        </div>
        <div className={cn("mt-1 space-y-1", isWeekView ? "space-y-2" : "space-y-1")}>
          {dayIdeas.slice(0, isWeekView ? 10 : 2).map(idea => renderIdeaCard(idea, !isWeekView))}
          {!isWeekView && dayIdeas.length > 2 && (
            <div className="text-xs text-muted-foreground">
              +{dayIdeas.length - 2} المزيد
            </div>
          )}
        </div>
      </div>
    );
  };

  if (ideasLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px]" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" data-testid="text-calendar-title">التقويم</h1>
              <Badge variant="secondary">{scheduledIdeas.length} مجدولة</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              عرض وجدولة أفكار الفيديو على التقويم
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-today">
              اليوم
            </Button>
            <Button variant="outline" size="icon" onClick={handlePrev} data-testid="button-prev-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext} data-testid="button-next-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center font-medium" data-testid="text-current-month">
              {format(currentDate, viewMode === "month" ? "MMMM yyyy" : "'الأسبوع' w, yyyy", { locale: ar })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant={viewMode === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("month")}
            data-testid="button-view-month"
          >
            <CalendarDays className="ml-2 h-4 w-4" />
            شهري
          </Button>
          <Button
            variant={viewMode === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("week")}
            data-testid="button-view-week"
          >
            <CalendarDays className="ml-2 h-4 w-4" />
            أسبوعي
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="border-l p-2 text-center text-sm font-medium text-muted-foreground first:border-l-0"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                {viewMode === "month" ? (
                  <div className="grid grid-cols-7">
                    {calendarDays.map((date) => renderDayCell(date))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7">
                    {weekDays.map((date) => renderDayCell(date, true))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    أفكار غير مجدولة
                  </h3>
                  <Badge variant="secondary">{unscheduledIdeas.length}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  اسحب الفكرة إلى التقويم لجدولتها
                </p>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {unscheduledIdeas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      لا توجد أفكار غير مجدولة
                    </p>
                  ) : (
                    unscheduledIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        draggable
                        onDragStart={() => handleDragStart(idea)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleEditIdea(idea)}
                        className={cn(
                          "cursor-pointer rounded-md p-3 hover-elevate active-elevate-2",
                          categoryColors[idea.category]?.bg || "bg-muted",
                          categoryColors[idea.category]?.text || "text-foreground"
                        )}
                        data-testid={`unscheduled-idea-${idea.id}`}
                      >
                        <div className="font-medium line-clamp-2">{idea.title}</div>
                        <div className="mt-1 text-xs opacity-75">
                          {ideaCategoryLabels[idea.category]}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Button 
              className="w-full" 
              onClick={() => {
                setSelectedIdea(null);
                setSelectedDate(null);
                setIdeaDialogOpen(true);
              }}
              data-testid="button-add-idea-calendar"
            >
              <Plus className="ml-2 h-4 w-4" />
              إضافة فكرة جديدة
            </Button>
          </div>
        </div>
      </div>

      <IdeaDialog
        open={ideaDialogOpen}
        onOpenChange={setIdeaDialogOpen}
        idea={selectedIdea}
        folders={folders}
        onSubmit={handleIdeaSubmit}
        isLoading={createIdeaMutation.isPending || updateIdeaMutation.isPending}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف الفكرة"
        description={`هل أنت متأكد من حذف الفكرة "${selectedIdea?.title}"؟`}
        onConfirm={() => selectedIdea && deleteIdeaMutation.mutate(selectedIdea.id)}
        isLoading={deleteIdeaMutation.isPending}
      />
    </MainLayout>
  );
}
