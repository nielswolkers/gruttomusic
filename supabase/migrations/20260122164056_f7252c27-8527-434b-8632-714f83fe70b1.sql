-- Create calendar_connections table for ICS calendar integrations
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'zermelo' or 'outlook'
  ics_url TEXT NOT NULL,
  display_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own calendar connections"
ON public.calendar_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar connections"
ON public.calendar_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections"
ON public.calendar_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections"
ON public.calendar_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();