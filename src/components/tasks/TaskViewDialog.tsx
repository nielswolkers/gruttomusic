import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Clock, CalendarPlus, Repeat, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Priority = "high" | "regular" | "low";
type RepeatType = "daily" | "weekly" | "monthly" | "yearly" | null;

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  add_to_calendar: boolean;
  repeat_type: RepeatType;
  repeat_interval: number;
  repeat_end_date: string | null;
  isRepeatInstance?: boolean;
  originalTaskId?: string;
}

interface TaskViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const priorityOptions: { value: Priority; label: string; color: string; bgColor: string }[] = [
  { value: "high", label: "Hoog", color: "bg-red-400", bgColor: "bg-red-100 border-red-300 text-red-700" },
  { value: "regular", label: "Normaal", color: "bg-orange-400", bgColor: "bg-orange-100 border-orange-300 text-orange-700" },
  { value: "low", label: "Laag", color: "bg-gray-400", bgColor: "bg-gray-100 border-gray-300 text-gray-600" },
];

const repeatOptions: { value: RepeatType; label: string }[] = [
  { value: null, label: "Niet herhalen" },
  { value: "daily", label: "Dagelijks" },
  { value: "weekly", label: "Wekelijks" },
  { value: "monthly", label: "Maandelijks" },
  { value: "yearly", label: "Jaarlijks" },
];

const TaskViewDialog = ({ open, onOpenChange, task, onUpdateTask, onDeleteTask }: TaskViewDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("regular");
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [dueTime, setDueTime] = useState<string>("");
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [repeatType, setRepeatType] = useState<RepeatType>(null);
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDueDate(new Date(task.due_date));
      setDueTime(task.due_time || "");
      setAddToCalendar(task.add_to_calendar);
      setRepeatType(task.repeat_type);
      setRepeatInterval(task.repeat_interval || 1);
      setRepeatEndDate(task.repeat_end_date ? new Date(task.repeat_end_date) : null);
    }
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim()) return;

    onUpdateTask({
      ...task,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: format(dueDate, "yyyy-MM-dd"),
      due_time: dueTime || null,
      add_to_calendar: addToCalendar,
      repeat_type: repeatType,
      repeat_interval: repeatInterval,
      repeat_end_date: repeatEndDate ? format(repeatEndDate, "yyyy-MM-dd") : null,
    });

    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!task) return;
    onDeleteTask(task.id);
    onOpenChange(false);
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Taak bewerken</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="view-task-title">Titel</Label>
            <Input
              id="view-task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wat moet er gebeuren?"
              className="rounded-xl"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="view-task-description">Beschrijving (optioneel)</Label>
            <Textarea
              id="view-task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Voeg details toe..."
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioriteit</Label>
            <div className="flex gap-2">
              {priorityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPriority(option.value)}
                  className={cn(
                    "flex-1 py-2.5 px-3 rounded-xl border-2 font-medium text-sm transition-all",
                    priority === option.value
                      ? option.bgColor
                      : "bg-background border-border text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", option.color)} />
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Datum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal rounded-xl",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "d MMM yyyy", { locale: nl }) : "Kies datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => date && setDueDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tijd (optioneel)</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="rounded-xl pl-9"
                />
              </div>
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Herhalen
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={repeatType || "none"}
                onValueChange={(value) => setRepeatType(value === "none" ? null : value as RepeatType)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Niet herhalen" />
                </SelectTrigger>
                <SelectContent>
                  {repeatOptions.map((option) => (
                    <SelectItem key={option.value || "none"} value={option.value || "none"}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {repeatType && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">elke</span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                    className="rounded-xl w-16 text-center"
                  />
                  <span className="text-sm text-muted-foreground">
                    {repeatType === "daily" && (repeatInterval === 1 ? "dag" : "dagen")}
                    {repeatType === "weekly" && (repeatInterval === 1 ? "week" : "weken")}
                    {repeatType === "monthly" && (repeatInterval === 1 ? "maand" : "maanden")}
                    {repeatType === "yearly" && (repeatInterval === 1 ? "jaar" : "jaar")}
                  </span>
                </div>
              )}
            </div>

            {repeatType && (
              <div className="pt-2">
                <Label className="text-sm text-muted-foreground">Einddatum (optioneel)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal rounded-xl mt-1",
                        !repeatEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {repeatEndDate ? format(repeatEndDate, "d MMM yyyy", { locale: nl }) : "Geen einddatum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={repeatEndDate || undefined}
                      onSelect={(date) => setRepeatEndDate(date || null)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Add to Calendar */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
            <Checkbox
              id="view-add-calendar"
              checked={addToCalendar}
              onCheckedChange={(checked) => setAddToCalendar(checked === true)}
              className="h-5 w-5 rounded"
            />
            <div className="flex items-center gap-2 flex-1">
              <CalendarPlus className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="view-add-calendar" className="text-sm font-normal cursor-pointer">
                Toevoegen aan agenda
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="rounded-xl text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 rounded-xl"
            >
              Opslaan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskViewDialog;
