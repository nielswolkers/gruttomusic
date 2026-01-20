import { useState, useEffect } from "react";
import { format, addDays, subDays, isToday, isBefore, startOfDay } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import TaskCreateDialog from "@/components/tasks/TaskCreateDialog";
import TaskViewDialog from "@/components/tasks/TaskViewDialog";
import { cn } from "@/lib/utils";

type RepeatType = "daily" | "weekly" | "monthly" | "yearly" | null;

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
  repeat_type: RepeatType;
  repeat_interval: number;
  repeat_end_date: string | null;
}

const priorityPillColors = {
  high: "bg-red-100 text-red-700 border-red-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const Taken = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

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
    repeatType: RepeatType;
    repeatInterval: number;
    repeatEndDate: Date | null;
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
        repeat_type: taskData.repeatType,
        repeat_interval: taskData.repeatInterval,
        repeat_end_date: taskData.repeatEndDate ? format(taskData.repeatEndDate, "yyyy-MM-dd") : null,
      });

      if (error) throw error;

      toast.success("Taak toegevoegd");
      loadTasks();
    } catch (error) {
      console.error("Failed to add task:", error);
      toast.error("Kon taak niet toevoegen");
    }
  };

  const handleUpdateTask = async (task: Task) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date,
          due_time: task.due_time,
          add_to_calendar: task.add_to_calendar,
          repeat_type: task.repeat_type,
          repeat_interval: task.repeat_interval,
          repeat_end_date: task.repeat_end_date,
        })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Taak bijgewerkt");
      loadTasks();
    } catch (error) {
      console.error("Failed to update task:", error);
      toast.error("Kon taak niet bijwerken");
    }
  };

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsViewDialogOpen(true);
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


      {/* Tasks list */}
      <div className="space-y-3 mb-6">
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
              onClick={() => handleTaskClick(task)}
              className={cn(
                "group flex items-center gap-4 p-4 rounded-2xl border bg-card transition-all cursor-pointer hover:shadow-sm",
                task.completed
                  ? "border-border/50 opacity-60"
                  : isOverdue(task)
                  ? "border-destructive/30"
                  : "border-border"
              )}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => {}}
                onClick={(e) => handleToggleComplete(task, e)}
                className="h-5 w-5 rounded-full border-2"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
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
                  {!task.completed && task.priority !== "regular" && (
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      priorityPillColors[task.priority]
                    )}>
                      {task.priority === "high" ? "Hoog" : "Laag"}
                    </span>
                  )}
                  {task.repeat_type && (
                    <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
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

      <TaskViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        task={selectedTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  );
};

export default Taken;
