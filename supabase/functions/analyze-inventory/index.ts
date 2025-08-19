import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set');
    }

    const { images } = await req.json();
    
    const systemPrompt = 'Please make an inventory of items to be moved and estimate a move volume in cu ft based on the pictures provided. Make sure to only count each item once even if shown on more than one picture. Regroup similar items, for example (4 wooden dinning chairs). For miscellaneous items or items that can be boxed, estimate a box count. You can use small, medium or large size boxes. Return a JSON array where each item has: name (string), quantity (number), volume (number in cu ft), weight (number in lbs).';

    // Prepare messages with images
    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          {
            type: 'text',
            text: 'Please analyze these photos and create an inventory for moving:'
          },
          ...images.map((image: string) => ({
            type: 'image_url',
            image_url: {
              url: image,
              detail: 'high'
            }
          }))
        ]
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages,
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisContent = data.choices[0].message.content;

    // Parse the JSON response from OpenAI
    let inventoryItems;
    try {
      // Clean the response in case it has markdown formatting
      const cleanContent = analysisContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      inventoryItems = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error('Failed to parse AI analysis results');
    }

    // Add IDs to the items
    const itemsWithIds = inventoryItems.map((item: any, index: number) => ({
      id: `item_${index + 1}`,
      ...item
    }));

    console.log('AI Analysis completed for', images.length, 'images, found', itemsWithIds.length, 'items');

    return new Response(JSON.stringify({ 
      items: itemsWithIds,
      itemCount: itemsWithIds.length,
      imageCount: images.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-inventory function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});