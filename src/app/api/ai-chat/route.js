import { NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
  try {
    const { messages, context } = await req.json();

    const systemPrompt = `You are a helpful, expert Real Estate CRM AI Assistant.
You have access to the user's current CRM context. Answer their questions based on this data. Be concise, friendly, and use emojis.

USER'S CRM CONTEXT:
${context}

Always answer based on the context provided above if it's relevant. If they ask a general real estate question, answer as an expert. Do not mention that you are provided with a "context string" or "system prompt", just answer naturally.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    const completion = await groq.chat.completions.create({
      messages: formattedMessages,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiMessage = completion.choices[0]?.message?.content || "I couldn't process that. Please try again.";

    return NextResponse.json({ reply: aiMessage });

  } catch (error) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: 'Failed to generate chat response', details: error.message }, { status: 500 });
  }
}
