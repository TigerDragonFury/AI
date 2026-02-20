import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestUser } from '@/lib/request-auth';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { streamCompletion, type ChatMessage } from '@/lib/ai-engine';

type Params = { params: Promise<{ id: string }> };

const msgSchema = z.object({
  content: z.string().min(1),
  stream:  z.boolean().default(true),
});

// GET /api/v1/ai/chat/[id]/messages — fetch history
export async function GET(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id: chatId } = await params;

  const supabase = getSupabaseServerClient();

  // Verify ownership
  const { data: chat } = await supabase
    .from('ai_chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single();
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, tokens_used, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/v1/ai/chat/[id]/messages — send message, stream reply
export async function POST(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id: chatId } = await params;

  const body = msgSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: body.error.issues.map(i => i.message).join(', ') }, { status: 422 });

  const supabase = getSupabaseServerClient();

  // Verify ownership + fetch chat config
  const { data: chat } = await supabase
    .from('ai_chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', userId)
    .single();
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 });

  // Fetch history (last 40 messages to stay within context)
  const { data: history } = await supabase
    .from('ai_chat_messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(40);

  // Persist user message
  await supabase.from('ai_chat_messages').insert({
    chat_id: chatId,
    role:    'user',
    content: body.data.content,
  });

  const messages: ChatMessage[] = [
    ...(chat.system_prompt ? [{ role: 'system' as const, content: chat.system_prompt }] : []),
    ...(history ?? []).reverse().map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: body.data.content },
  ];

  // Get streaming response from AI engine
  const aiResponse = await streamCompletion({
    model: chat.model,
    messages,
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    return NextResponse.json({ error: errText }, { status: 502 });
  }

  // If client doesn't want streaming, collect full response and save
  if (!body.data.stream) {
    let full = '';
    const reader = aiResponse.body?.getReader();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          const trimmed = line.replace(/^data:\s*/, '').trim();
          if (!trimmed || trimmed === '[DONE]') continue;
          try {
            const json = JSON.parse(trimmed);
            full += json.choices?.[0]?.delta?.content ?? '';
          } catch { /* skip */ }
        }
      }
    }
    await supabase.from('ai_chat_messages').insert({ chat_id: chatId, role: 'assistant', content: full });
    await supabase.from('ai_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
    return NextResponse.json({ role: 'assistant', content: full });
  }

  // Streaming: pipe AI SSE → client SSE, saving full response when done
  const encoder = new TextEncoder();
  let assistantReply = '';
  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiResponse.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { controller.close(); return; }
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          controller.enqueue(encoder.encode(chunk));
          // Extract text for persisting
          for (const line of chunk.split('\n')) {
            const trimmed = line.replace(/^data:\s*/, '').trim();
            if (!trimmed || trimmed === '[DONE]') continue;
            try {
              const json = JSON.parse(trimmed);
              assistantReply += json.choices?.[0]?.delta?.content ?? '';
              // Anthropic / Gemini deltas handled below
              if (json.type === 'content_block_delta') assistantReply += json.delta?.text ?? '';
              if (json.candidates) assistantReply += json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            } catch { /* skip */ }
          }
        }
      } finally {
        controller.close();
        // Persist assistant reply
        if (assistantReply) {
          await supabase.from('ai_chat_messages').insert({ chat_id: chatId, role: 'assistant', content: assistantReply });
          await supabase.from('ai_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}

// DELETE /api/v1/ai/chat/[id]/messages — archive (soft-delete) the chat
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireRequestUser(request);
  if (!auth.ok) return auth.response;
  const { userId } = auth.auth;
  const { id: chatId } = await params;

  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('ai_chats')
    .update({ is_archived: true })
    .eq('id', chatId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
