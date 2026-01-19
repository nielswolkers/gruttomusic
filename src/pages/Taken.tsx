import { useState, useEffect } from "react";
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: "high" | "regular" | "low";
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  add_to_calendar: boolean;
}

const priorityColors = {
  high: "bg-red-100 border-red-300",
  regular: "bg-orange-100 border-orange-300",
  low: "bg-gray-100 border-gray-300",
};

const priorityDotColors = {
  high: "bg-red-400",
  regular: "bg-orange-400",
  low: "bg-gray-400",
};

const Taken = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user, selectedDate]);

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      // If viewing today, also get incomplete tasks from previous days
      if (dateStr === today) {
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .or(`due_date.eq.${dateStr},and(due_date.lt.${dateStr},completed.eq.false)`)
          .order("due_date", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) throw error;
        setTasks((data as Task[]) || []);
      } else {
        // For other dates, only show tasks for that specific day
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("due_date", dateStr)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setTasks((data as Task[]) || []);
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
      toast.error("Kon taken niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    priority: "high" | "regular" | "low";
    dueDate: Date;
    dueTime: string | null;
    addToCalendar: boolean;
  }) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        due_date: format(taskData.dueDate, "yyyy-MM-dd"),
        due_time: taskData.dueTime || null,
        add_to_calendar: taskData.addToCalendar,
      });

      if (error) throw error;

      toast.success("Taak toegevoegd");
      loadTasks();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("Kon taak niet toevoegen");
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          completed: !task.completed,
          completed_at: !task.completed ? new Date().toISOString() : null,
        })
        .eq("id", task.id);

      if (error) throw error;
      loadTasks();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Kon taak niet bijwerken");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) throw error;
      toast.success("Taak verwijderd");
      loadTasks();
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error("Kon taak niet verwijderen");
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const formatDateHeader = () => {
    if (isToday(selectedDate)) {
      return "Vandaag";
    }
    return format(selectedDate, "EEEE d MMMM", { locale: nl });
  };

  const isOverdue = (task: Task) => {
    const taskDate = new Date(task.due_date);
    return isBefore(taskDate, startOfDay(new Date())) && !task.completed;
  };

  const formatTime = (time: string | null) => {
    if (!time) return null;
    const [hours, minutes] = time.split(":");
    return `${hours}:${minutes}`;
  };

  if (!user) return null;

  return (
    <div className="w-full">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-foreground capitalize">
          {formatDateHeader()}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-9 w-9"
            onClick={goToPreviousDay}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 px-4"
              onClick={goToToday}
            >
              Vandaag
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-9 w-9"
            onClick={goToNextDay}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Date subtitle */}
      {isToday(selectedDate) && (
        <p className="text-muted-foreground mb-6">
          {format(selectedDate, "EEEE d MMMM yyyy", { locale: nl })}
        </p>
      )}

      {/* Tasks list */}
      <div className="space-y-3 mb-6 max-w-2xl">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Geen taken voor deze dag</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                task.completed
                  ? "bg-muted/30 border-border/50"
                  : isOverdue(task)
                  ? "bg-destructive/5 border-destructive/20"
                  : priorityColors[task.priority]
              )}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => handleToggleComplete(task)}
                className="h-5 w-5 rounded-full border-2"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!task.completed && (
                    <div className={cn("w-2 h-2 rounded-full", priorityDotColors[task.priority])} />
                  )}
                  <p
                    className={cn(
                      "font-medium",
                      task.completed
                        ? "line-through text-muted-foreground"
                        : isOverdue(task)
                        ? "text-destructive"
                        : "text-foreground"
                    )}
                  >
                    {task.title}
                  </p>
                </div>
                {task.description && !task.completed && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {task.due_time && (
                    <span className="text-xs text-muted-foreground">
                      {formatTime(task.due_time)}
                    </span>
                  )}
                  {isOverdue(task) && (
                    <span className="text-xs text-destructive">
                      Verlopen: {format(new Date(task.due_date), "d MMM", { locale: nl })}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}

        {/* Add task button */}
        <Button
          variant="outline"
          className="w-full rounded-2xl h-14 border-dashed justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="w-5 h-5" />
          Nieuwe taak toevoegen
        </Button>
      </div>

      <TaskCreateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateTask={handleCreateTask}
        initialDate={selectedDate}
      />
    </div>
  );
};

export default Taken;
