-- Add priority column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'regular';

-- Add time column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_time time DEFAULT NULL;

-- Add add_to_calendar column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS add_to_calendar boolean DEFAULT false;