import { useState, useEffect } from "react";
import { format, addDays, subDays, isToday, isBefore, startOfDay, addWeeks, addMonths, addYears, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears, isAfter, isSameDay } from "date-fns";
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

interface DisplayTask extends Task {
  isRepeatInstance?: boolean;
  originalTaskId?: string;
}

const priorityPillColors = {
  high: "bg-red-100 text-red-700 border-red-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

// Truncate text to max words
const truncateWords = (text: string, maxWords: number): string => {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
};

// Check if a repeating task should appear on a specific date
const shouldRepeatOnDate = (task: Task, targetDate: Date): boolean => {
  if (!task.repeat_type) return false;
  
  const taskStartDate = startOfDay(new Date(task.due_date));
  const target = startOfDay(targetDate);
  
  // Task can't repeat before its start date
  if (isBefore(target, taskStartDate)) return false;
  
  // Check end date
  if (task.repeat_end_date && isAfter(target, new Date(task.repeat_end_date))) {
    return false;
  }
  
  // If it's the same day as start, it's handled by the regular query
  if (isSameDay(target, taskStartDate)) return false;
  
  const interval = task.repeat_interval || 1;
  
  switch (task.repeat_type) {
    case "daily": {
      const daysDiff = differenceInDays(target, taskStartDate);
      return daysDiff > 0 && daysDiff % interval === 0;
    }
    case "weekly": {
      const weeksDiff = differenceInWeeks(target, taskStartDate);
      if (weeksDiff > 0 && weeksDiff % interval === 0) {
        return target.getDay() === taskStartDate.getDay();
      }
      return false;
    }
    case "monthly": {
      const monthsDiff = differenceInMonths(target, taskStartDate);
      if (monthsDiff > 0 && monthsDiff % interval === 0) {
        return target.getDate() === taskStartDate.getDate();
      }
      return false;
    }
    case "yearly": {
      const yearsDiff = differenceInYears(target, taskStartDate);
      if (yearsDiff > 0 && yearsDiff % interval === 0) {
        return target.getDate() === taskStartDate.getDate() && 
               target.getMonth() === taskStartDate.getMonth();
      }
      return false;
    }
    default:
      return false;
  }
};

const Taken = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<DisplayTask | null>(null);
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

      const { data: allTasks, error: allError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (allError) throw allError;

      const allTasksTyped = (allTasks as Task[]) || [];
      let displayTasks: DisplayTask[] = [];

      const tasksForDate = allTasksTyped.filter(t => t.due_date === dateStr);
      displayTasks.push(...tasksForDate);

      if (dateStr === today) {
        const overdueTasks = allTasksTyped.filter(
          t => t.due_date < dateStr && !t.completed && !t.repeat_type
        );
        displayTasks.push(...overdueTasks);
      }

      const repeatingTasks = allTasksTyped.filter(t => t.repeat_type && !t.completed);
      for (const task of repeatingTasks) {
        if (shouldRepeatOnDate(task, selectedDate)) {
          const existingInstance = allTasksTyped.find(
            t => t.title === task.title && t.due_date === dateStr && t.id !== task.id
          );
          
          if (!existingInstance) {
            displayTasks.push({
              ...task,
              due_date: dateStr,
              completed: false,
              completed_at: null,
              isRepeatInstance: true,
              originalTaskId: task.id,
            });
          }
        }
      }

      displayTasks.sort((a, b) => {
        if (a.due_time && b.due_time) {
          return a.due_time.localeCompare(b.due_time);
        }
        if (a.due_time) return -1;
        if (b.due_time) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setTasks(displayTasks);
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

    // Truncate title to max 25 words and description to max 200 words
    const truncatedTitle = truncateWords(taskData.title, 25);
    const truncatedDescription = truncateWords(taskData.description, 200);

    try {
      const { error } = await supabase.from("tasks").insert({
        user_id: user.id,
        title: truncatedTitle,
        description: truncatedDescription || null,
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

    // Truncate on update as well
    const truncatedTitle = truncateWords(task.title, 25);
    const truncatedDescription = task.description ? truncateWords(task.description, 200) : null;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: truncatedTitle,
          description: truncatedDescription,
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

  const handleToggleComplete = async (task: DisplayTask, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      if (task.isRepeatInstance && task.originalTaskId) {
        const { error } = await supabase.from("tasks").insert({
          user_id: user.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.due_date,
          due_time: task.due_time,
          add_to_calendar: task.add_to_calendar,
          repeat_type: null,
          repeat_interval: 1,
          repeat_end_date: null,
          completed: true,
          completed_at: new Date().toISOString(),
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .update({
            completed: !task.completed,
            completed_at: !task.completed ? new Date().toISOString() : null,
          })
          .eq("id", task.id);

        if (error) throw error;
      }
      
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

  const handleTaskClick = (task: DisplayTask) => {
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
    <div className="w-full max-w-full h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <h1 className="text-4xl font-bold text-foreground capitalize truncate">
          {formatDateHeader()}
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0">
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
      <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden pb-6">
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
                "group flex items-center gap-4 p-4 rounded-2xl border bg-card transition-all cursor-pointer hover:shadow-sm max-w-full",
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
                className="h-5 w-5 rounded-full border-2 flex-shrink-0"
              />
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <p
                    className={cn(
                      "font-medium truncate min-w-0 flex-1",
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
                      "text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0",
                      priorityPillColors[task.priority]
                    )}>
                      {task.priority === "high" ? "Hoog" : "Laag"}
                    </span>
                  )}
                  {task.repeat_type && (
                    <Repeat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
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