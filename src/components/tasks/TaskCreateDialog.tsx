import { useState } from "react";
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
import { CalendarIcon, Clock, CalendarPlus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type Priority = "high" | "regular" | "low";

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (task: {
    title: string;
    description: string;
    priority: Priority;
    dueDate: Date;
    dueTime: string | null;
    addToCalendar: boolean;
  }) => void;
  initialDate: Date;
}

const priorityOptions: { value: Priority; label: string; color: string; bgColor: string }[] = [
  { value: "high", label: "Hoog", color: "bg-red-400", bgColor: "bg-red-100 border-red-300 text-red-700" },
  { value: "regular", label: "Normaal", color: "bg-orange-400", bgColor: "bg-orange-100 border-orange-300 text-orange-700" },
  { value: "low", label: "Laag", color: "bg-gray-400", bgColor: "bg-gray-100 border-gray-300 text-gray-600" },
];

const TaskCreateDialog = ({ open, onOpenChange, onCreateTask, initialDate }: TaskCreateDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("regular");
  const [dueDate, setDueDate] = useState<Date>(initialDate);
  const [dueTime, setDueTime] = useState<string>("");
  const [addToCalendar, setAddToCalendar] = useState(false);

  const handleSubmit = () => {
    if (!title.trim()) return;

    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      dueTime: dueTime || null,
      addToCalendar,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setPriority("regular");
    setDueTime("");
    setAddToCalendar(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority("regular");
    setDueTime("");
    setAddToCalendar(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Nieuwe taak</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-5 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Titel</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Wat moet er gebeuren?"
              className="rounded-xl"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="task-description">Beschrijving (optioneel)</Label>
            <Textarea
              id="task-description"
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

          {/* Add to Calendar */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
            <Checkbox
              id="add-calendar"
              checked={addToCalendar}
              onCheckedChange={(checked) => setAddToCalendar(checked === true)}
              className="h-5 w-5 rounded"
            />
            <div className="flex items-center gap-2 flex-1">
              <CalendarPlus className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="add-calendar" className="text-sm font-normal cursor-pointer">
                Toevoegen aan agenda
              </Label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 rounded-xl"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 rounded-xl"
            >
              Toevoegen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCreateDialog;
