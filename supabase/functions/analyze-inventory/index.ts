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
    
    const { image, imageNumber } = body;
    
    if (!image || typeof image !== 'string') {
      console.error('No image provided or image is not a string');
      throw new Error('Image is required');
    }
    
    console.log('Processing single image, number:', imageNumber);
    
    const systemPrompt = 'Please make an inventory of items to be moved and estimate a move volume in cu ft based on this single photo. For each item you identify, provide the following: name (string), quantity (number), volume (number in cu ft), weight (number in lbs). Return a JSON array where each item has these properties. Be thorough but avoid duplicating items that might appear in multiple photos of the same room.';

    // Prepare the image - ensure it's a proper data URL
    let processedImage = image;
    if (!image.startsWith('data:image/')) {
      console.warn('Image does not start with data:image/, adding prefix');
      processedImage = `data:image/jpeg;base64,${image}`;
    }

    console.log('Prepared single image for OpenAI API');

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          {
            type: 'text',
            text: 'Please analyze this photo and create an inventory for moving. List all items you can identify with their estimated volume and weight:'
          },
          {
            type: 'image_url',
            image_url: {
              url: processedImage,
              detail: 'high' // Use high detail for single image analysis
            }
          }
        ]
      }
    ];

    console.log('Making OpenAI API call with single image');

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

    // Add IDs and image number to the items
    const itemsWithIds = inventoryItems.map((item: any, index: number) => ({
      id: `item_${imageNumber}_${index + 1}`,
      found_in_image: imageNumber,
      ...item
    }));

    console.log('AI Analysis completed for image', imageNumber, ', found', itemsWithIds.length, 'items');

    return new Response(JSON.stringify({ 
      items: itemsWithIds,
      itemCount: itemsWithIds.length,
      imageNumber: imageNumber
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