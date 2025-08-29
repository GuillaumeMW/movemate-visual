-- Add sharing control columns to inventory_sessions
ALTER TABLE public.inventory_sessions 
ADD COLUMN access_mode text DEFAULT 'private' CHECK (access_mode IN ('private', 'shared')),
ADD COLUMN shared_at timestamp with time zone,
ADD COLUMN shared_by_name text,
ADD COLUMN shared_by_email text;

-- Create inventory_access_tokens table for managing share permissions
CREATE TABLE public.inventory_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  access_level text NOT NULL CHECK (access_level IN ('view', 'edit')),
  recipient_name text,
  recipient_email text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_accessed_at timestamp with time zone,
  access_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by_name text,
  created_by_email text
);

-- Enable RLS on inventory_access_tokens
ALTER TABLE public.inventory_access_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for inventory_access_tokens
CREATE POLICY "Anyone can view access tokens" 
ON public.inventory_access_tokens 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create access tokens" 
ON public.inventory_access_tokens 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update access tokens" 
ON public.inventory_access_tokens 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete access tokens" 
ON public.inventory_access_tokens 
FOR DELETE 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_inventory_access_tokens_session_id ON public.inventory_access_tokens(session_id);
CREATE INDEX idx_inventory_access_tokens_token ON public.inventory_access_tokens(token);
CREATE INDEX idx_inventory_access_tokens_active ON public.inventory_access_tokens(is_active) WHERE is_active = true;