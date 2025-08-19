-- Add found_in_image column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN found_in_image integer;