-- Fix function security issue by recreating with proper settings
DROP TRIGGER IF EXISTS update_inventory_sessions_updated_at ON public.inventory_sessions;
DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Recreate function with proper security settings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers
CREATE TRIGGER update_inventory_sessions_updated_at
  BEFORE UPDATE ON public.inventory_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();