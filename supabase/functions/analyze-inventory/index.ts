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
    
    const { image, imageNumber, existingItems = [] } = body;
    
    if (!image || typeof image !== 'string') {
      console.error('No image provided or image is not a string');
      throw new Error('Image is required');
    }
    
    console.log('Processing single image, number:', imageNumber);
    
    // Build existing items context
    let existingItemsContext = '';
    if (existingItems && existingItems.length > 0) {
      const itemList = existingItems.map(item => `- ${item.name} (qty: ${item.quantity})`).join('\n');
      existingItemsContext = `\n\nITEMS ALREADY FOUND IN PREVIOUS IMAGES:\n${itemList}\n\nDO NOT DUPLICATE these items unless you see additional quantities in this new photo.`;
    }

    const systemPrompt = `You are analyzing photos for a moving inventory. Create a conservative inventory focused on PRIMARY items that are clearly visible and likely to be moved. 

CRITICAL INSTRUCTIONS:
- Focus on FOREGROUND items that are the main subject of the photo
- AVOID background items, wall decorations, or built-in fixtures unless they're clearly moveable
- Be CONSERVATIVE - it's better to miss an item than create duplicates
- For furniture, only count major pieces (sofas, beds, tables, not small decorative items)
- For kitchen items, focus on appliances and major cookware, not every dish or utensil
- Avoid counting items that typically stay with a property (light fixtures, cabinets, countertops)
- Group similar small items together (e.g., "Books" rather than listing each book)${existingItemsContext}

Return a JSON array where each item has: name (string), quantity (number), volume (number in cu ft), weight (number in lbs).`;

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
            text: `Please analyze this photo and create a conservative moving inventory focusing only on PRIMARY, moveable items in the FOREGROUND. 

AVOID:
- Built-in appliances, cabinets, fixtures
- Background/wall decorations unless clearly removable
- Small clutter or individual books/dishes (group these)
- Items that are barely visible or questionable

FOCUS ON:
- Major furniture pieces
- Clearly moveable appliances
- Obvious personal belongings
- Items that would require boxes or effort to move

List only items you are confident need to be moved:`
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