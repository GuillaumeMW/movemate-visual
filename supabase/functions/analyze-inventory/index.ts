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
    
    const { mode = 'item-analysis', images, image, imageNumber, existingItems = [], roomMappings = {} } = body;
    
    // Handle different modes
    if (mode === 'room-detection') {
      console.log('Processing room detection for', images?.length || 0, 'images');
      return await handleRoomDetection(images, OPENAI_API_KEY);
    }
    
    if (!image || typeof image !== 'string') {
      console.error('No image provided or image is not a string');
      throw new Error('Image is required');
    }
    
    console.log('Processing single image, number:', imageNumber);
    
    // Build existing items context with room awareness
    let existingItemsContext = '';
    const currentRooms = roomMappings[`image${imageNumber}`] || [];
    
    if (existingItems && existingItems.length > 0) {
      // Create a comprehensive list of already found items to prevent duplication
      const allFoundItems = existingItems.map((item: any) => 
        `- ${item.name} (qty: ${item.quantity}) in ${item.room || 'Unknown'}`
      );
      
      existingItemsContext = `\n\nITEMS ALREADY CATALOGED IN PREVIOUS IMAGES:\n${allFoundItems.join('\n')}\n\n🚨 CRITICAL: These items have already been recorded. DO NOT list them again unless:\n1. You see CLEARLY ADDITIONAL quantities of the same item in this new photo\n2. The additional items are in a DIFFERENT location/room\n\nIf you see any of these items again, SKIP them completely - they are already in the inventory.`;
    }
    
    // Build room context for current image with strict validation
    let roomContext = '';
    if (currentRooms.length > 0) {
      roomContext = `\n\nTHIS IMAGE CONTAINS THE FOLLOWING ROOMS: ${currentRooms.join(', ')}\n\n🔒 ROOM ASSIGNMENT RULE: You MUST assign each item to one of these EXACT room names: ${currentRooms.join(', ')}. Do not create new room names or variations - use ONLY these detected room names.`;
    }

    const systemPrompt = `You are analyzing photos for a moving inventory. Create a conservative inventory focused on PRIMARY items that are clearly visible and likely to be moved. 

CRITICAL INSTRUCTIONS:
- Focus on FOREGROUND items that are the main subject of the photo
- AVOID background items or built-in fixtures unless they're clearly moveable
- Be mindful of artwork, mirrors hanging on walls, and rugs that would be moved
- For furniture, only count major pieces (sofas, beds, tables, not small decorative items)
- For kitchen items, focus on appliances and major cookware, not every dish or utensil
- Avoid counting items that typically stay with a property (light fixtures, cabinets, countertops)

BOX GROUPING INSTRUCTIONS:
Items that would normally be moved in boxes should be combined into box estimates:
- Small Boxes (1.5 cu ft, 15 lbs per box): Books, CDs, DVDs, kitchen gadgets → estimate number of small boxes needed
- Medium Boxes (3 cu ft, 25 lbs per box): Clothing, towels, decorative items, small appliances → estimate medium boxes
- Large Boxes (4.5 cu ft, 30 lbs per box): Bedding, linens, larger toys, lampshades → estimate large boxes  
- Extra-Large Boxes (6 cu ft, 35 lbs per box): Comforters, pillows, sports equipment → estimate extra-large boxes

CRITICAL: When specifying box quantities, always use PER-BOX measurements:
- Volume: Use the individual box volume (1.5, 3, 4.5, or 6 cu ft)
- Weight: Use the individual box weight (15, 25, 30, or 35 lbs)
- Quantity: The NUMBER of boxes needed
Example: For 6 medium boxes, use quantity=6, volume=3, weight=25 (NOT quantity=6, volume=18, weight=150)

HIDDEN STORAGE ESTIMATION:
You MUST also estimate boxes for contents that cannot be seen but would typically be stored in:
- Kitchen cabinets and pantries: dishes, cookware, food items, small appliances
- Dressers and wardrobes: clothing, personal items
- Bathroom cabinets: toiletries, medications, towels
- Closets: clothing, shoes, linens, storage items
- Bookcases and shelving: books, decorative items, storage
- Office furniture: papers, supplies, equipment
- Any other storage furniture visible in the room

For these ESTIMATED items, use the labels:
- "Small boxes (est.)" for kitchen items, toiletries, office supplies, books
- "Medium boxes (est.)" for clothing, linens, general household items
- "Large boxes (est.)" for bulky stored items, bedding, seasonal items

ESTIMATION GUIDELINES:
- Kitchen: 2-4 small boxes per cabinet, 1-2 medium boxes per pantry
- Dresser: 2-3 medium boxes per dresser (clothing)
- Bathroom cabinet: 1 small box per cabinet
- Closet: 3-5 medium boxes for clothing closets, 2-3 large boxes for linen closets
- Bookcase: 1 small box per shelf section
- Office desk: 1-2 small boxes per desk

Example: Instead of listing "20 books, 15 CDs, 10 kitchen gadgets" → list "Small Boxes" with quantity 3-4${existingItemsContext}${roomContext}

Return a JSON array where each item has: name (string), quantity (number), volume (number in cu ft), weight (number in lbs), room (string - the specific numbered room where this item is located, must match one of the rooms listed above for this image).`;

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
- Built-in cabinets, fixtures
- Small clutter or individual books/dishes (group these)
- Items that are barely visible or questionable

FOCUS ON:
- Major furniture pieces
- Moveable appliances
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

// Room detection handler
async function handleRoomDetection(images: string[], apiKey: string) {
  if (!images || images.length === 0) {
    throw new Error('No images provided for room detection');
  }

  console.log('Starting room detection for', images.length, 'images');

  const systemPrompt = `You are analyzing photos to identify and map rooms for a moving inventory system. Your task is to:

1. Identify all room types visible in each image  
2. CRITICALLY: Recognize when the same room appears in multiple images from different angles
3. Only create multiple numbered rooms when they are genuinely different spaces

SAME ROOM IDENTIFICATION (CRITICAL):
Before creating multiple numbered rooms of the same type, look for these consistency markers:
- **Architectural features**: Same windows, doors, ceiling height, room shape
- **Fixed elements**: Built-in cabinets, countertops, flooring patterns, wall colors
- **Furniture arrangement**: Similar furniture placement and room layout
- **Lighting conditions**: Natural light sources, window positions
- **Unique characteristics**: Distinctive fixtures, appliances, or architectural details

ONLY number rooms (e.g., "Bedroom 1", "Bedroom 2") when you can identify DISTINCT:
- Different room sizes or layouts
- Different architectural features (windows, doors, built-ins)
- Different purposes (master bedroom vs guest bedroom)
- Different locations in the house (upstairs vs downstairs)

ROOM IDENTIFICATION RULES:
- BE CONSERVATIVE: If unsure whether rooms are the same, assume they are the same room
- One image can show multiple rooms (open floor plans, doorways)
- The same room photographed from different angles should have the same name
- Look for visual cues: furniture, fixtures, layout, purpose
- Consider room characteristics only when they are clearly different spaces

ROOM TYPES TO IDENTIFY:
- Living Room, Kitchen, Bedroom, Bathroom, Office, Dining Room
- Garage, Basement, Closet, Laundry Room, Hallway, Other
- Shed, Outdoor Area, Storage Room, Sun Room, Patio, Deck, Balcony, Attic, Pantry, Mudroom

Return a JSON object with:
{
  "rooms_detected": ["Kitchen", "Living Room", "Bedroom 1", "Bedroom 2", "Bathroom"],
  "image_room_mapping": {
    "image1": ["Kitchen", "Dining Room"],
    "image2": ["Living Room"],
    "image3": ["Bedroom 1"],
    "image4": ["Bedroom 2"],
    "image5": ["Bathroom"],
    "image6": ["Kitchen", "Living Room"]
  }
}`;

  // Prepare all images for the API call
  const imageMessages = images.map((image, index) => {
    let processedImage = image;
    if (!image.startsWith('data:image/')) {
      processedImage = `data:image/jpeg;base64,${image}`;
    }
    
    return {
      type: 'image_url',
      image_url: {
        url: processedImage,
        detail: 'low' // Use low detail for room detection to save costs
      }
    };
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { 
      role: 'user', 
      content: [
        {
          type: 'text',
          text: `Please analyze these ${images.length} photos and identify all rooms. Pay attention to:
- Multiple rooms of the same type should be numbered
- Consider room size, features, and purpose for numbering
- One image may show multiple rooms
- The same room may appear in multiple images from different angles

Return the room mapping as specified in the system prompt.`
        },
        ...imageMessages
      ]
    }
  ];

  console.log('Making OpenAI API call for room detection');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages,
      max_completion_tokens: 1500,
    }),
  });

  console.log('Room detection OpenAI response status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('OpenAI API error in room detection:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Room detection response received');
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    console.error('Invalid OpenAI response structure for room detection:', data);
    throw new Error('Invalid response from OpenAI API');
  }
  
  const analysisContent = data.choices[0].message.content;
  console.log('Room detection content length:', analysisContent.length);

  // Parse the JSON response
  let roomMapping;
  try {
    // Extract JSON from response
    let jsonContent = '';
    
    const codeBlockMatch = analysisContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonContent = codeBlockMatch[1].trim();
      console.log('Extracted room detection JSON from markdown');
    } else {
      // Find JSON object in content
      const objStart = analysisContent.indexOf('{');
      if (objStart !== -1) {
        let depth = 0;
        let inString = false;
        let escaped = false;
        let objEnd = objStart;
        
        for (let i = objStart; i < analysisContent.length; i++) {
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
            if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0) {
                objEnd = i;
                break;
              }
            }
          }
        }
        
        if (depth === 0) {
          jsonContent = analysisContent.substring(objStart, objEnd + 1);
          console.log('Extracted room detection JSON using depth tracking');
        }
      }
    }
    
    if (!jsonContent) {
      throw new Error('No valid JSON found in room detection response');
    }
    
    roomMapping = JSON.parse(jsonContent);
    console.log('Successfully parsed room detection JSON');
    console.log('Rooms detected:', roomMapping.rooms_detected);
    
  } catch (parseError) {
    console.error('Room detection JSON parsing failed:', parseError.message);
    console.error('Raw response:', analysisContent);
    
    // Fallback: create basic room mapping
    console.log('Using fallback room mapping');
    roomMapping = {
      rooms_detected: ["Living Room", "Kitchen", "Bedroom", "Bathroom"],
      image_room_mapping: {}
    };
    
    // Assign basic rooms to images
    for (let i = 1; i <= images.length; i++) {
      roomMapping.image_room_mapping[`image${i}`] = ["Living Room"];
    }
  }

  console.log('Room detection completed');
  
  return new Response(JSON.stringify(roomMapping), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}