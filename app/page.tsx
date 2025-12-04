// app/new/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function NewAIInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // 如果正在流式传输，停止当前响应
    if (isStreaming) {
      handleStop();
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // 添加空的助手消息
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const url = process.env.NODE_ENV === 'development' 
        ? process.env.NEXT_PUBLIC_BASE_URL!
        : '/v1/chat/completions';

      abortControllerRef.current = new AbortController();
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
            { role: 'user', content: userMessage }
          ],
          network: false,
          model: '@tx/deepseek-ai/deepseek-v3-0324'
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const token = json.choices?.[0]?.delta?.content || '';
              
              accumulatedContent += token;
              
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                  role: 'assistant',
                  content: accumulatedContent
                };
                return newMessages;
              });
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Error:', error);
        setMessages(prev => [
          ...prev.slice(0, -1),
          { 
            role: 'assistant', 
            content: '抱歉，出现了错误。请重试。' 
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const quickPrompts = [
    "写一段关于人工智能的简短介绍",
    "解释什么是机器学习",
    "帮我写一封专业的商务邮件",
    "推荐一些学习编程的方法"
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 头部 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-800">AI 助手</h1>
            <div className="text-sm text-gray-500">
              基于 DeepSeek 大模型
            </div>
          </div>
        </div>
      </header>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="text-center mt-20">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                欢迎使用 AI 助手
              </h2>
              <p className="text-gray-500 mb-8">
                我可以帮助您回答问题、创作内容、编写代码等
              </p>
              
              {/* 快速提示词 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {quickPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => setInput(prompt)}
                    className="p-3 text-left bg-white rounded-lg border border-gray-200 
                             hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <span className="text-gray-700">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-3xl rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-800 shadow-sm border border-gray-200'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          code: ({ node, inline, className, children, ...props }) => (
                            <code
                              className={`${
                                inline
                                  ? 'bg-gray-100 px-1 py-0.5 rounded text-sm'
                                  : 'block bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto'
                              }`}
                              {...props}
                            >
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content || '思考中...'}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入您的问题..."
              disabled={isLoading}
              className="flex-1 p-3 border border-gray-300 rounded-lg resize-none 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-medium
                       hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       transition-colors"
            >
              {isStreaming ? '停止' : '发送'}
            </button>
          </form>
          
          <div className="mt-2 text-xs text-gray-500 text-center">
            按 Enter 发送消息，Shift + Enter 换行
          </div>
        </div>
      </footer>
    </div>
  );
}
