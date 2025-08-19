-- Create inventory_sessions table
CREATE TABLE public.inventory_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_volume DECIMAL DEFAULT 0,
  total_weight DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'active'
);

-- Create inventory_items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  volume DECIMAL NOT NULL DEFAULT 0,
  weight DECIMAL NOT NULL DEFAULT 0,
  notes TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create uploaded_images table
CREATE TABLE public.uploaded_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public access for now - no auth required)
CREATE POLICY "Anyone can view inventory sessions" 
ON public.inventory_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create inventory sessions" 
ON public.inventory_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update inventory sessions" 
ON public.inventory_sessions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete inventory sessions" 
ON public.inventory_sessions 
FOR DELETE 
USING (true);

CREATE POLICY "Anyone can view inventory items" 
ON public.inventory_items 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create inventory items" 
ON public.inventory_items 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update inventory items" 
ON public.inventory_items 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete inventory items" 
ON public.inventory_items 
FOR DELETE 
USING (true);

CREATE POLICY "Anyone can view uploaded images" 
ON public.uploaded_images 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create uploaded images" 
ON public.uploaded_images 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update uploaded images" 
ON public.uploaded_images 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete uploaded images" 
ON public.uploaded_images 
FOR DELETE 
USING (true);

-- Create storage bucket for inventory images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inventory-images', 'inventory-images', true);

-- Create storage policies
CREATE POLICY "Anyone can view inventory images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'inventory-images');

CREATE POLICY "Anyone can upload inventory images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'inventory-images');

CREATE POLICY "Anyone can update inventory images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'inventory-images');

CREATE POLICY "Anyone can delete inventory images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'inventory-images');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_inventory_sessions_updated_at
  BEFORE UPDATE ON public.inventory_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();