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
    console.log('Starting analyze-inventory function');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY is not set');
      throw new Error('OPENAI_API_KEY is not set');
    }

    const body = await req.json();
    console.log('Request body received, keys:', Object.keys(body));
    
    const { images } = body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      console.error('No images provided or images is not an array');
      throw new Error('Images array is required');
    }
    
    console.log('Processing', images.length, 'images');
    
    const systemPrompt = 'Please make an inventory of items to be moved and estimate a move volume in cu ft based on the pictures provided. Make sure to only count each item once even if shown on more than one picture. Regroup similar items, for example (4 wooden dinning chairs). For miscellaneous items or items that can be boxed, estimate a box count. You can use small, medium or large size boxes. For each item, mention on which photo you found it for easy tracking (use photo numbers 1, 2, 3, etc.). Return a JSON array where each item has: name (string), quantity (number), volume (number in cu ft), weight (number in lbs), found_in_image (number indicating which photo, starting from 1).';

    // Prepare messages with images - limit image size for API
    const processedImages = images.map((image: string) => {
      // Ensure the image is a proper data URL
      if (!image.startsWith('data:image/')) {
        console.warn('Image does not start with data:image/, adding prefix');
        return `data:image/jpeg;base64,${image}`;
      }
      return image;
    });

    console.log('Prepared', processedImages.length, 'images for OpenAI API');

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          {
            type: 'text',
            text: 'Please analyze these photos and create an inventory for moving:'
          },
          ...processedImages.slice(0, 5).map((image: string) => ({  // Limit to 5 images max
            type: 'image_url',
            image_url: {
              url: image,
              detail: 'low' // Use low detail to reduce API costs and avoid timeouts
            }
          }))
        ]
      }
    ];

    console.log('Making OpenAI API call with', messages[1].content.length - 1, 'images');

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

    console.log('OpenAI response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response received, has choices:', !!data.choices);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', data);
      throw new Error('Invalid response from OpenAI API');
    }
    
    const analysisContent = data.choices[0].message.content;
    console.log('Analysis content length:', analysisContent.length);

    // Parse the JSON response from OpenAI
    let inventoryItems;
    try {
      // Clean the response in case it has markdown formatting
      const cleanContent = analysisContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      console.log('Attempting to parse JSON:', cleanContent.substring(0, 200) + '...');
      inventoryItems = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw content:', analysisContent);
      
      // Fallback: try to extract JSON from the response
      const jsonMatch = analysisContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          inventoryItems = JSON.parse(jsonMatch[0]);
          console.log('Successfully parsed JSON from regex match');
        } catch (regexParseError) {
          console.error('Regex parse also failed:', regexParseError);
          throw new Error('Failed to parse AI analysis results');
        }
      } else {
        throw new Error('No valid JSON found in AI response');
      }
    }

    if (!Array.isArray(inventoryItems)) {
      console.error('Parsed result is not an array:', typeof inventoryItems);
      throw new Error('AI response is not a valid array');
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
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});