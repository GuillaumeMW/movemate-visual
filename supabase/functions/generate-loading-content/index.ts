import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Educational topics that rotate based on day of year
const topics = [
  "the fascinating world of marine biology and deep ocean creatures",
  "the history of ancient civilizations and their remarkable achievements", 
  "space exploration and the mysteries of our solar system",
  "the science behind renewable energy and sustainable technology",
  "the Renaissance period and its revolutionary impact on art and science",
  "the wonders of the human brain and how memory works",
  "the evolution of communication from cave paintings to the internet",
  "fascinating facts about the natural world and biodiversity",
  "the principles of physics that govern our everyday lives",
  "the history of music and how different genres evolved",
  "the science of weather patterns and climate phenomena",
  "archaeological discoveries that changed our understanding of history"
];

function getTodaysTopic(): string {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return topics[dayOfYear % topics.length];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const topic = getTodaysTopic();
    
    console.log(`Generating content for topic: ${topic}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a fun facts writer. Create short, engaging content with surprising and interesting facts. Write exactly 4-6 short sentences with fun facts. Use simple, easy-to-read language. Each fact should be surprising or little-known. Do not use any special formatting or headers.' 
          },
          { 
            role: 'user', 
            content: `Write 4-6 fun facts about ${topic}. Make each fact surprising and easy to understand. Use simple words and short sentences.` 
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('Successfully generated content');

    return new Response(JSON.stringify({ 
      content: generatedContent,
      topic: topic 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-loading-content function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback: true 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});