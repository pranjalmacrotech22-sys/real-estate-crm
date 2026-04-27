import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';
import { supabase } from '@/lib/supabase'; // NOTE: This will fail server-side if it uses client browser auth. Assuming we just return the text for now.

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { lead, action } = await req.json();

    if (action === 'score') {
      const prompt = `Analyze this real estate lead and assign a score (0-100) and a temperature (hot, warm, cold). 
      Lead Info: 
      Budget: ${lead.budget_min} to ${lead.budget_max}
      Priority: ${lead.priority}
      Location: ${lead.preferred_location}
      Notes: ${lead.notes}

      Return ONLY valid JSON in this format: {"score": 85, "temperature": "hot"}`;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{"score": 50, "temperature": "warm"}');
      return NextResponse.json(result);
    }

    if (action === 'suggest_followup') {
      const prompt = `You are a real estate agent's AI assistant. Write a short, friendly WhatsApp follow-up message to this lead.
      Lead Name: ${lead.full_name}
      Interested in: ${lead.property_type}
      Budget: ₹${lead.budget_max}
      Status: ${lead.status}
      Notes: ${lead.notes}
      
      Keep it professional but casual, use an emoji or two. Do not include placeholders, make it ready to send.`;

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
      });

      return NextResponse.json({ message: completion.choices[0]?.message?.content });
    }

    if (action === 'recommend_properties') {
       // Ideally we query the DB here, but for demonstration, we will let the client fetch properties and pass them, or AI suggests criteria.
       const prompt = `Based on this lead (Budget: ₹${lead.budget_max}, Type: ${lead.property_type}, Location: ${lead.preferred_location}), write a WhatsApp message recommending 2 hypothetical properties that perfectly match.`;
       
       const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
      });

      return NextResponse.json({ message: completion.choices[0]?.message?.content });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('AI Assist Error:', error);
    return NextResponse.json({ error: 'Failed to process AI request', details: error.message }, { status: 500 });
  }
}
