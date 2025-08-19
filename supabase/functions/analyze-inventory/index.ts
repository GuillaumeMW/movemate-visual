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

    const { items, analysisType } = await req.json();
    
    let systemPrompt = '';
    switch (analysisType) {
      case 'value':
        systemPrompt = 'You are an expert appraiser. Analyze these inventory items and provide estimated values, condition assessments, and market insights. Return a JSON object with insights for each item.';
        break;
      case 'categorize':
        systemPrompt = 'You are an inventory specialist. Categorize these items into logical groups and suggest optimal organization. Return a JSON object with categories and recommendations.';
        break;
      case 'insights':
        systemPrompt = 'You are a business analyst. Analyze this inventory data and provide actionable insights about trends, opportunities, and recommendations. Return a JSON object with detailed analysis.';
        break;
      default:
        systemPrompt = 'You are an inventory expert. Analyze these items and provide helpful insights.';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analyze these inventory items: ${JSON.stringify(items, null, 2)}` 
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0].message.content;

    console.log('AI Analysis completed for', items.length, 'items');

    return new Response(JSON.stringify({ 
      analysis,
      itemCount: items.length,
      analysisType 
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