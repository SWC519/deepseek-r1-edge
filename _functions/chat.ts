// 纯 JS，无类型
export async function onRequestPost(ctx) {
  const upstream = await fetch('https://ai.enencloud.top/v1/chat/completions', {
    method: 'POST',
    headers: ctx.请求.headers,
    body: ctx.请求.body,
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.choices?.[0]?.delta?.content) {
            content += data.choices[0].delta.content;
          }
        } catch {}
      }
    }
  }

  return new Response(
    JSON.stringify({
      id: crypto.randomUUID(),
      object: 'chat.completion',
      created: Date.now(),
      model: upstream.headers.get('x-model') || '@tx/deepseek-ai/deepseek-v3-0324',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
