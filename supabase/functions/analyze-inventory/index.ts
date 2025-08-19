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
- AVOID background items or built-in fixtures unless they're clearly moveable
- Be CONSERVATIVE - it's better to miss an item than create duplicates
- Be mindful of artwork, mirrors hanging on walls, and rugs that would be moved
- For furniture, only count major pieces (sofas, beds, tables, not small decorative items)
- For kitchen items, focus on appliances and major cookware, not every dish or utensil
- Avoid counting items that typically stay with a property (light fixtures, cabinets, countertops)

BOX GROUPING INSTRUCTIONS:
Items that would normally be moved in boxes should be combined into box estimates:
- Small Boxes (1.5 cu ft): Books, CDs, DVDs, kitchen gadgets → estimate number of small boxes needed
- Medium Boxes (3 cu ft): Clothing, towels, decorative items, small appliances → estimate medium boxes
- Large Boxes (4.5 cu ft): Bedding, linens, larger toys, lampshades → estimate large boxes  
- Extra-Large Boxes (6 cu ft): Comforters, pillows, sports equipment → estimate extra-large boxes

Example: Instead of listing "20 books, 15 CDs, 10 kitchen gadgets" → list "Small Boxes" with quantity 3-4${existingItemsContext}

Return a JSON array where each item has: name (string), quantity (number), volume (number in cu ft), weight (number in lbs), room (string - the room where this item is located based on visual context, e.g., "Living Room", "Kitchen", "Bedroom", "Bathroom", "Office", "Garage", "Basement", "Dining Room", "Closet", "Laundry Room").`;

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
      console.log('Raw OpenAI content length:', analysisContent.length);
      
      // Multiple extraction strategies
      let jsonContent = '';
      
      // Strategy 1: Extract from markdown code blocks
      const codeBlockMatch = analysisContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        const blockContent = codeBlockMatch[1].trim();
        // Extract just the JSON array part, ignoring any additional text
        const arrayMatch = blockContent.match(/(\[[\s\S]*?\])/);
        if (arrayMatch) {
          jsonContent = arrayMatch[1];
          console.log('Extracted JSON from markdown code block');
        }
      }
      
      // Strategy 2: Find JSON array anywhere in content
      if (!jsonContent) {
        const arrayStart = analysisContent.indexOf('[');
        if (arrayStart !== -1) {
          let depth = 0;
          let inString = false;
          let escaped = false;
          let arrayEnd = arrayStart;
          
          for (let i = arrayStart; i < analysisContent.length; i++) {
            const char = analysisContent[i];
            
            if (escaped) {
              escaped = false;
              continue;
            }
            
            if (char === '\\') {
              escaped = true;
              continue;
            }
            
            if (char === '"' && !escaped) {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '[' || char === '{') {
                depth++;
              } else if (char === ']' || char === '}') {
                depth--;
                if (depth === 0 && char === ']') {
                  arrayEnd = i;
                  break;
                }
              }
            }
          }
          
          if (depth === 0) {
            jsonContent = analysisContent.substring(arrayStart, arrayEnd + 1);
            console.log('Extracted JSON using depth tracking');
          }
        }
      }
      
      if (!jsonContent) {
        throw new Error('No valid JSON array found in OpenAI response');
      }
      
      // Clean and validate JSON content
      jsonContent = jsonContent.trim();
      console.log('Final JSON content (first 200 chars):', jsonContent.substring(0, 200));
      
      inventoryItems = JSON.parse(jsonContent);
      console.log('Successfully parsed JSON, found', inventoryItems.length, 'items');
      
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError.message);
      console.error('Raw OpenAI response:', analysisContent);
      
      // Last resort: return empty array to prevent complete failure
      console.log('Returning empty array as fallback');
      inventoryItems = [];
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