-- Add safety_factor column to inventory_sessions table
ALTER TABLE public.inventory_sessions 
ADD COLUMN safety_factor numeric DEFAULT 1.0;