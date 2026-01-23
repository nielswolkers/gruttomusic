import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Monitor, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type TimeFilter = 'vandaag' | 'week' | 'maand';
type SidebarMode = 'events' | 'create';

const filterTitles: Record<TimeFilter, string> = {
  vandaag: 'Vandaag',
  week: 'Deze week',
  maand: 'Deze maand',
};

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: 'task' | 'zermelo' | 'outlook' | 'google';
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

const EVENT_COLORS = [
  { name: 'yellow', value: '#FBBF24' },
  { name: 'orange', value: '#F97316' },
  { name: 'red', value: '#EF4444' },
  { name: 'pink', value: '#EC4899' },
  { name: 'green', value: '#10B981' },
  { name: 'cyan', value: '#06B6D4' },
  { name: 'blue', value: '#3B82F6' },
  { name: 'gray', value: '#9CA3AF' },
];

const Agenda = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('maand');
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('events');
  const [searchQuery, setSearchQuery] = useState('');

  // Event creation form state
  const [newEventTitle, setNewEventTitle] = useState('Nieuwe Gebeurtenis');
  const [newEventStartDate, setNewEventStartDate] = useState('');
  const [newEventEndDate, setNewEventEndDate] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('13:20');
  const [newEventEndTime, setNewEventEndTime] = useState('16:25');
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventRepeat, setNewEventRepeat] = useState('none');
  const [newEventReminder, setNewEventReminder] = useState('5min');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventColor, setNewEventColor] = useState('#10B981');
  const [newEventInvitees, setNewEventInvitees] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
  }, [user, currentDate]);

  useEffect(() => {
    // Update date pickers when selected date changes
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setNewEventStartDate(dateStr);
    setNewEventEndDate(dateStr);
  }, [selectedDate]);

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

      // Load ICS calendar connections and fetch via edge function
      const { data: connections } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id);

      let icsEvents: CalendarEvent[] = [];

      for (const connection of (connections || []) as CalendarConnection[]) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-ics`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ url: connection.ics_url }),
            }
          );
          if (response.ok) {
            const { content } = await response.json();
            const parsed = parseICS(content, connection.provider as 'zermelo' | 'outlook');
            icsEvents = [...icsEvents, ...parsed];
          }
        } catch (error) {
          console.error(`Failed to fetch ICS from ${connection.provider}:`, error);
        }
      }

      // Load Google Calendar events
      let googleEvents: CalendarEvent[] = [];
      const { data: googleConnection } = await supabase
        .from('google_calendar_connections')
        .select('access_token, refresh_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (googleConnection?.access_token) {
        try {
          const timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
          const timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();
          
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                access_token: googleConnection.access_token,
                refresh_token: googleConnection.refresh_token,
                time_min: timeMin,
                time_max: timeMax,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            
            // Update token if refreshed
            if (data.new_token) {
              await supabase
                .from('google_calendar_connections')
                .update({ access_token: data.new_token, updated_at: new Date().toISOString() })
                .eq('user_id', user.id);
            }

            googleEvents = (data.events || []).map((event: any) => ({
              id: `google-${event.id}`,
              title: event.title,
              start: new Date(event.start),
              end: new Date(event.end),
              allDay: event.allDay,
              source: 'google' as const,
              color: event.calendarColor || '#EA4335',
            }));
          }
        } catch (error) {
          console.error('Failed to fetch Google Calendar events:', error);
        }
      }

      setEvents([...taskEvents, ...icsEvents, ...googleEvents]);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Navigation handlers
  const navigatePrevious = () => {
    if (timeFilter === 'vandaag') {
      setCurrentDate(subDays(currentDate, 1));
      setSelectedDate(subDays(currentDate, 1));
    } else if (timeFilter === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (timeFilter === 'vandaag') {
      setCurrentDate(addDays(currentDate, 1));
      setSelectedDate(addDays(currentDate, 1));
    } else if (timeFilter === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week view calculations
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Day view hours
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const eventsForSelectedDate = useMemo(() => {
    return events.filter(event => isSameDay(event.start, selectedDate));
  }, [events, selectedDate]);

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.start, day));
  };

  // Get events that overlap with a specific hour (for proper positioning)
  const getEventsForHourRange = (day: Date) => {
    return events.filter(event => {
      if (event.allDay) return false;
      return isSameDay(event.start, day);
    });
  };

  const getAllDayEventsForDay = (day: Date) => {
    return events.filter(event => event.allDay && isSameDay(event.start, day));
  };

  // Calculate event position and height in the time grid
  const getEventStyle = (event: CalendarEvent, hourHeight: number) => {
    const startHour = event.start.getHours();
    const startMinute = event.start.getMinutes();
    const endHour = event.end.getHours();
    const endMinute = event.end.getMinutes();
    
    const startOffset = (startMinute / 60) * hourHeight;
    const durationMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    const height = Math.max((durationMinutes / 60) * hourHeight, 20); // Minimum 20px height
    
    return {
      top: `${startOffset}px`,
      height: `${height}px`,
    };
  };

  const weekDayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  // Get the navigation title based on view
  const getNavigationTitle = () => {
    if (timeFilter === 'vandaag') {
      return format(currentDate, 'd MMMM yyyy', { locale: nl });
    } else if (timeFilter === 'week') {
      return `${format(weekStart, 'd', { locale: nl })} - ${format(weekEnd, 'd MMMM yyyy', { locale: nl })}`;
    }
    return format(currentDate, 'MMMM yyyy', { locale: nl });
  };

  // Calculate duration display
  const calculateDuration = () => {
    if (newEventAllDay) return '';
    const [startH, startM] = newEventStartTime.split(':').map(Number);
    const [endH, endM] = newEventEndTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const diffMins = endMins - startMins;
    if (diffMins <= 0) return '';
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `(${hours}h ${mins}m)`;
  };

  return (
    <div className="w-full h-[calc(100vh-7rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h1 className="text-4xl font-bold text-foreground">{filterTitles[timeFilter]}</h1>
        
        {/* macOS-style segmented control */}
        <div className="flex bg-muted rounded-lg p-1 gap-0.5">
          {(['vandaag', 'week', 'maand'] as TimeFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                timeFilter === filter
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter === 'vandaag' ? 'Vandaag' : filter === 'week' ? 'Week' : 'Maand'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col bg-card rounded-2xl border border-border p-6 min-h-0 overflow-hidden">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className="text-2xl font-semibold capitalize">
              {getNavigationTitle()}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={navigatePrevious}
                className="rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToToday}
                className="rounded-full px-4"
              >
                Vandaag
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={navigateNext}
                className="rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Month View */}
          {timeFilter === 'maand' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Week Days Header */}
              <div className="grid grid-cols-7 gap-1 mb-2 flex-shrink-0">
                {weekDayHeaders.map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr overflow-hidden">
                {days.map((day) => {
                  const dayEvents = getEventsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentDate);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setSidebarMode('events');
                      }}
                      className={cn(
                        "relative p-2 rounded-xl text-sm transition-all flex flex-col items-start overflow-hidden",
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
          )}

          {/* Week View */}
          {timeFilter === 'week' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Week Header */}
              <div className="grid grid-cols-8 gap-1 mb-2 flex-shrink-0">
                <div className="w-14" /> {/* Time column spacer */}
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setSidebarMode('events');
                      }}
                      className={cn(
                        "text-center py-2 rounded-lg transition-all",
                        isSelected && "bg-primary text-primary-foreground",
                        !isSelected && isToday && "bg-primary/10",
                        !isSelected && "hover:bg-muted/50"
                      )}
                    >
                      <div className="text-xs text-muted-foreground font-medium">
                        {format(day, 'EEE', { locale: nl })}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        isToday && !isSelected && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* All Day Events */}
              <div className="grid grid-cols-8 gap-1 mb-2 flex-shrink-0">
                <div className="w-14 text-xs text-muted-foreground text-right pr-2 pt-1">Hele dag</div>
                {weekDays.map((day) => {
                  const allDayEvents = getAllDayEventsForDay(day);
                  return (
                    <div key={day.toISOString()} className="min-h-[32px]">
                      {allDayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs px-1 py-0.5 rounded truncate mb-0.5"
                          style={{ backgroundColor: event.color, color: 'white' }}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Time Grid */}
              <ScrollArea className="flex-1">
                <div className="relative">
                  {/* Time labels column */}
                  <div className="absolute left-0 top-0 w-14">
                    {hours.map((hour) => (
                      <div key={hour} className="h-12 text-xs text-muted-foreground text-right pr-2 flex items-start justify-end">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  
                  {/* Grid with events */}
                  <div className="grid grid-cols-7 gap-1 ml-14">
                    {weekDays.map((day) => {
                      const dayEvents = getEventsForHourRange(day);
                      return (
                        <div key={day.toISOString()} className="relative">
                          {/* Hour cells */}
                          {hours.map((hour) => {
                            const isNow = isSameDay(day, new Date()) && new Date().getHours() === hour;
                            return (
                              <div
                                key={hour}
                                className={cn(
                                  "h-12 border-t border-border/50",
                                  isNow && "bg-primary/5"
                                )}
                              />
                            );
                          })}
                          
                          {/* Events overlay */}
                          {dayEvents.map((event) => {
                            const startHour = event.start.getHours();
                            const style = getEventStyle(event, 48); // 48px = h-12
                            return (
                              <div
                                key={event.id}
                                className="absolute inset-x-0.5 text-xs px-1 py-0.5 rounded truncate z-10 overflow-hidden"
                                style={{ 
                                  backgroundColor: event.color, 
                                  color: 'white',
                                  top: `calc(${startHour * 48}px + ${style.top})`,
                                  height: style.height,
                                }}
                              >
                                {event.title}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Day View */}
          {timeFilter === 'vandaag' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* All Day Events */}
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <div className="w-14 text-xs text-muted-foreground text-right pr-2 pt-1">Hele dag</div>
                <div className="flex-1 min-h-[32px] flex flex-wrap gap-1">
                  {getAllDayEventsForDay(currentDate).map((event) => (
                    <div
                      key={event.id}
                      className="text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: event.color, color: 'white' }}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Grid */}
              <ScrollArea className="flex-1">
                <div className="relative">
                  {/* Hour rows */}
                  {hours.map((hour) => {
                    const isNow = isSameDay(currentDate, new Date()) && new Date().getHours() === hour;
                    return (
                      <div key={hour} className="flex gap-2">
                        <div className="w-14 text-xs text-muted-foreground text-right pr-2 h-16 flex items-start justify-end pt-1 flex-shrink-0">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div
                          className={cn(
                            "flex-1 h-16 border-t border-border/50",
                            isNow && "bg-primary/5"
                          )}
                        />
                      </div>
                    );
                  })}
                  
                  {/* Events overlay */}
                  <div className="absolute left-16 right-0 top-0">
                    {getEventsForHourRange(currentDate).map((event) => {
                      const startHour = event.start.getHours();
                      const style = getEventStyle(event, 64); // 64px = h-16
                      return (
                        <div
                          key={event.id}
                          className="absolute inset-x-1 text-sm px-2 py-1 rounded z-10 overflow-hidden"
                          style={{ 
                            backgroundColor: event.color, 
                            color: 'white',
                            top: `calc(${startHour * 64}px + ${style.top})`,
                            height: style.height,
                          }}
                        >
                          <span className="font-medium">{event.title}</span>
                          <span className="ml-2 opacity-80">
                            {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Right Sidebar - Fixed Width */}
        <div className="w-80 flex flex-col gap-4 overflow-hidden flex-shrink-0">
          {/* Events/Create Card */}
          <div className="flex-1 bg-card rounded-2xl border border-border p-5 flex flex-col overflow-hidden min-h-0">
            {sidebarMode === 'create' ? (
              <>
                {/* Create Event Header - Editable Title */}
                <Input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="text-lg font-semibold mb-4 flex-shrink-0 border-none bg-transparent px-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Nieuwe Gebeurtenis"
                />
                
                <ScrollArea className="flex-1">
                  <div className="space-y-4 pr-2">
                    {/* Date */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Datum</Label>
                      <Input
                        type="text"
                        value={`${format(new Date(newEventStartDate || selectedDate), 'd MMMM yyyy', { locale: nl })} - ${format(new Date(newEventEndDate || selectedDate), 'd MMM...', { locale: nl })}`}
                        className="flex-1 h-9 text-sm"
                        readOnly
                      />
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Tijd</Label>
                      <div className="flex-1 flex items-center gap-1">
                        <Input
                          type="time"
                          value={newEventStartTime}
                          onChange={(e) => setNewEventStartTime(e.target.value)}
                          className="h-9 text-sm flex-1"
                          disabled={newEventAllDay}
                        />
                        <span className="text-muted-foreground">-</span>
                        <Input
                          type="time"
                          value={newEventEndTime}
                          onChange={(e) => setNewEventEndTime(e.target.value)}
                          className="h-9 text-sm flex-1"
                          disabled={newEventAllDay}
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {calculateDuration()}
                        </span>
                      </div>
                    </div>

                    {/* All Day Toggle */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Hele dag</Label>
                      <Switch
                        checked={newEventAllDay}
                        onCheckedChange={setNewEventAllDay}
                      />
                    </div>

                    {/* Repeat */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Herhalen</Label>
                      <Select value={newEventRepeat} onValueChange={setNewEventRepeat}>
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nooit</SelectItem>
                          <SelectItem value="daily">Dagelijks</SelectItem>
                          <SelectItem value="weekly">Wekelijks</SelectItem>
                          <SelectItem value="monthly">Maandelijks</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reminder */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Herinneringen</Label>
                      <Select value={newEventReminder} onValueChange={setNewEventReminder}>
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Geen</SelectItem>
                          <SelectItem value="5min">5 minuten</SelectItem>
                          <SelectItem value="15min">15 minuten</SelectItem>
                          <SelectItem value="30min">30 minuten</SelectItem>
                          <SelectItem value="1hour">1 uur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Description */}
                    <div className="flex gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0 pt-2">Beschrijving</Label>
                      <Textarea
                        value={newEventDescription}
                        onChange={(e) => setNewEventDescription(e.target.value)}
                        className="flex-1 min-h-[80px] text-sm resize-none"
                        placeholder=""
                      />
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Kleur</Label>
                      <div className="flex gap-2">
                        {EVENT_COLORS.map((color) => (
                          <button
                            key={color.name}
                            onClick={() => setNewEventColor(color.value)}
                            className={cn(
                              "w-6 h-6 rounded-full transition-all",
                              newEventColor === color.value && "ring-2 ring-offset-2 ring-primary"
                            )}
                            style={{ backgroundColor: color.value }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Calendar Selection */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Agenda's</Label>
                      <Select defaultValue="personal">
                        <SelectTrigger className="flex-1 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="personal">Persoonlijk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Invitees */}
                    <div className="flex items-center gap-3">
                      <Label className="w-24 text-sm text-muted-foreground flex-shrink-0">Uitnodigen</Label>
                      <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={newEventInvitees}
                          onChange={(e) => setNewEventInvitees(e.target.value)}
                          className="h-9 text-sm pl-8"
                          placeholder="gebruikersnaam zoe..."
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <>
                {/* Selected Day Events Header */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Geen afspraken</p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
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
                            {event.source === 'task' ? 'Taak' : event.source === 'zermelo' ? 'Zermelo' : event.source === 'google' ? 'Google' : 'Outlook'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {/* Search */}
                <div className="mt-4 pt-4 border-t border-border flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Zoeken in Agenda"
                      className="pl-9 h-10"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons - Only show in events mode */}
          {sidebarMode === 'events' && (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3 rounded-xl"
                onClick={() => setSidebarMode('create')}
              >
                <Plus className="w-5 h-5" />
                Voeg gebeurtenis toe
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 justify-start gap-3 rounded-xl"
              >
                <Monitor className="w-5 h-5" />
                Plan een meeting
              </Button>
            </div>
          )}

          {/* Back button in create mode */}
          {sidebarMode === 'create' && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl flex-shrink-0"
              onClick={() => {
                // Reset form and go back to events view
                setNewEventTitle('Nieuwe Gebeurtenis');
                setNewEventDescription('');
                setNewEventStartTime('13:20');
                setNewEventEndTime('16:25');
                setNewEventAllDay(false);
                setNewEventRepeat('none');
                setNewEventReminder('5min');
                setNewEventColor('#10B981');
                setNewEventInvitees('');
                setIsCreatingEvent(false);
                setCreatedEventId(null);
                setSidebarMode('events');
              }}
            >
              Annuleren
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Agenda;
