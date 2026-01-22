import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: 'task' | 'zermelo' | 'outlook';
  color: string;
}

interface Task {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  completed: boolean;
}

interface CalendarConnection {
  id: string;
  provider: string;
  ics_url: string;
  display_name: string | null;
}

const parseICS = (icsContent: string, source: 'zermelo' | 'outlook'): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split(/\r?\n/);
  let currentEvent: Partial<CalendarEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line folding
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { source, color: source === 'zermelo' ? '#3B82F6' : '#8B5CF6' };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.title && currentEvent.start) {
        events.push({
          id: `${source}-${Math.random().toString(36).substr(2, 9)}`,
          title: currentEvent.title,
          start: currentEvent.start,
          end: currentEvent.end || currentEvent.start,
          allDay: currentEvent.allDay || false,
          source,
          color: currentEvent.color!,
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8).replace(/\\,/g, ',').replace(/\\;/g, ';');
      } else if (line.startsWith('DTSTART')) {
        const dateStr = line.split(':').pop() || '';
        currentEvent.allDay = !dateStr.includes('T');
        currentEvent.start = parseICSDate(dateStr);
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.split(':').pop() || '';
        currentEvent.end = parseICSDate(dateStr);
      }
    }
  }

  return events;
};

const parseICSDate = (dateStr: string): Date => {
  // Format: 20240115T120000Z or 20240115
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  
  if (dateStr.includes('T')) {
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));
    
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }
  
  return new Date(year, month, day);
};

const Agenda = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, currentDate]);

  const loadEvents = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, due_time, completed')
        .eq('user_id', user.id)
        .eq('completed', false);

      const taskEvents: CalendarEvent[] = (tasks || []).map((task: Task) => {
        const date = parseISO(task.due_date);
        if (task.due_time) {
          const [hours, minutes] = task.due_time.split(':');
          date.setHours(parseInt(hours), parseInt(minutes));
        }
        return {
          id: `task-${task.id}`,
          title: task.title,
          start: date,
          end: date,
          allDay: !task.due_time,
          source: 'task' as const,
          color: '#10B981',
        };
      });

      // Load calendar connections and fetch ICS
      const { data: connections } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id);

      let icsEvents: CalendarEvent[] = [];

      for (const connection of (connections || []) as CalendarConnection[]) {
        try {
          const response = await fetch(connection.ics_url);
          if (response.ok) {
            const icsContent = await response.text();
            const parsed = parseICS(icsContent, connection.provider as 'zermelo' | 'outlook');
            icsEvents = [...icsEvents, ...parsed];
          }
        } catch (error) {
          console.error(`Failed to fetch ICS from ${connection.provider}:`, error);
        }
      }

      setEvents([...taskEvents, ...icsEvents]);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsForSelectedDate = useMemo(() => {
    return events.filter(event => isSameDay(event.start, selectedDate));
  }, [events, selectedDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.start, day));
  };

  const weekDays = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold text-foreground">Agenda</h1>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col bg-card rounded-2xl border border-border p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: nl })}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(new Date());
                }}
                className="rounded-full px-4"
              >
                Vandaag
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1 flex-1">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative p-2 rounded-xl text-sm transition-all min-h-[80px] flex flex-col items-start",
                    isSelected && "bg-primary text-primary-foreground",
                    !isSelected && isToday && "bg-primary/10",
                    !isSelected && !isToday && "hover:bg-muted/50",
                    !isCurrentMonth && "text-muted-foreground/50"
                  )}
                >
                  <span className={cn(
                    "font-medium mb-1",
                    isToday && !isSelected && "text-primary"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Event dots */}
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {dayEvents.slice(0, 3).map((event, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isSelected ? "bg-primary-foreground/70" : ""
                        )}
                        style={{ backgroundColor: isSelected ? undefined : event.color }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className={cn(
                        "text-xs",
                        isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Events */}
        <div className="w-80 bg-card rounded-2xl border border-border p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {format(selectedDate, 'd MMMM', { locale: nl })}
              </h3>
              <p className="text-sm text-muted-foreground capitalize">
                {format(selectedDate, 'EEEE', { locale: nl })}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : eventsForSelectedDate.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">Geen afspraken</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {eventsForSelectedDate.map((event) => (
                <div
                  key={event.id}
                  className="p-3 rounded-xl border-l-4"
                  style={{ 
                    borderLeftColor: event.color,
                    backgroundColor: `${event.color}10`
                  }}
                >
                  <p className="font-medium text-sm">{event.title}</p>
                  {!event.allDay && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(event.start, 'HH:mm')}
                      {event.end && event.start.getTime() !== event.end.getTime() && 
                        ` - ${format(event.end, 'HH:mm')}`}
                    </p>
                  )}
                  <span 
                    className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: event.color, color: 'white' }}
                  >
                    {event.source === 'task' ? 'Taak' : event.source === 'zermelo' ? 'Zermelo' : 'Outlook'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Legenda</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                <span className="text-xs">Taken</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                <span className="text-xs">Zermelo</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                <span className="text-xs">Outlook</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agenda;
