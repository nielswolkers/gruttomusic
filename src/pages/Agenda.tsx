import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type TimeFilter = 'vandaag' | 'week' | 'maand';

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

const Agenda = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('maand');

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

  const getEventsForHour = (day: Date, hour: number) => {
    return events.filter(event => {
      if (event.allDay) return false;
      return isSameDay(event.start, day) && event.start.getHours() === hour;
    });
  };

  const getAllDayEventsForDay = (day: Date) => {
    return events.filter(event => event.allDay && isSameDay(event.start, day));
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

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
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
                      onClick={() => setSelectedDate(day)}
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
                      onClick={() => setSelectedDate(day)}
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
                <div className="grid grid-cols-8 gap-1">
                  {hours.map((hour) => (
                    <div key={hour} className="contents">
                      <div className="w-14 text-xs text-muted-foreground text-right pr-2 h-12 flex items-start justify-end">
                        {hour.toString().padStart(2, '0')}:00
                      </div>
                      {weekDays.map((day) => {
                        const hourEvents = getEventsForHour(day, hour);
                        const isNow = isSameDay(day, new Date()) && new Date().getHours() === hour;
                        return (
                          <div
                            key={`${day.toISOString()}-${hour}`}
                            className={cn(
                              "h-12 border-t border-border/50 relative",
                              isNow && "bg-primary/5"
                            )}
                          >
                            {hourEvents.map((event) => (
                              <div
                                key={event.id}
                                className="absolute inset-x-0 top-0 text-xs px-1 py-0.5 rounded truncate z-10"
                                style={{ backgroundColor: event.color, color: 'white' }}
                              >
                                {event.title}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
                <div className="space-y-0">
                  {hours.map((hour) => {
                    const hourEvents = getEventsForHour(currentDate, hour);
                    const isNow = isSameDay(currentDate, new Date()) && new Date().getHours() === hour;
                    return (
                      <div key={hour} className="flex gap-2">
                        <div className="w-14 text-xs text-muted-foreground text-right pr-2 h-16 flex items-start justify-end pt-1">
                          {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div
                          className={cn(
                            "flex-1 h-16 border-t border-border/50 relative",
                            isNow && "bg-primary/5"
                          )}
                        >
                          {hourEvents.map((event) => (
                            <div
                              key={event.id}
                              className="absolute inset-x-1 top-1 text-sm px-2 py-1 rounded z-10"
                              style={{ backgroundColor: event.color, color: 'white' }}
                            >
                              <span className="font-medium">{event.title}</span>
                              <span className="ml-2 opacity-80">
                                {format(event.start, 'HH:mm')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Selected Day Events - Fixed Height Sidebar */}
        <div className="w-80 bg-card rounded-2xl border border-border p-6 flex flex-col overflow-hidden">
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
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : eventsForSelectedDate.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
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

          {/* Legend */}
          <div className="mt-4 pt-4 border-t border-border flex-shrink-0">
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
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#EA4335]" />
                <span className="text-xs">Google</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Agenda;
