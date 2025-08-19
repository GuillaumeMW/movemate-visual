-- Add is_going column to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN is_going boolean NOT NULL DEFAULT true;

-- Add comment to describe the column
COMMENT ON COLUMN public.inventory_items.is_going IS 'Whether the item is being moved (going) or staying behind (not going)';