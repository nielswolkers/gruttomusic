-- Add repeat fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN repeat_type TEXT DEFAULT NULL,
ADD COLUMN repeat_interval INTEGER DEFAULT 1,
ADD COLUMN repeat_end_date DATE DEFAULT NULL;

-- Add comment for the repeat_type column
COMMENT ON COLUMN public.tasks.repeat_type IS 'Values: daily, weekly, monthly, yearly, or null for no repeat';