-- Replace notes column with room column in inventory_items table
ALTER TABLE public.inventory_items 
DROP COLUMN IF EXISTS notes;

ALTER TABLE public.inventory_items 
ADD COLUMN room text;

-- Add comment to describe the column
COMMENT ON COLUMN public.inventory_items.room IS 'The room where the item is located (detected by AI or set by user)';