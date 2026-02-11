import { groqService } from "./services/groq";
import { cerebrasService } from "./services/cerebras";
import { geminiService } from "./services/gemini";
import { openRouterService } from "./services/openrouter";
import type { AIService, ChatMessage } from "./types";

// ✅ Array con TODOS los servicios
const services: AIService[] = [
    groqService,
    cerebrasService,
    geminiService,
    openRouterService
];

let currentServiceIndex = 0;

function getNextService() {
    const service = services[currentServiceIndex];
    currentServiceIndex = (currentServiceIndex + 1) % services.length;
    return service;
}

const server = Bun.serve({
    port: process.env.PORT ?? 3009,
    async fetch(req) {
        const { pathname } = new URL(req.url);
        const url = new URL(req.url);
        const noStream = url.searchParams.get('stream') === 'false';

        // Servir archivos estáticos
        if (pathname === "/" || pathname === "/index.html") {
            return new Response(Bun.file("./public/index.html"));
        }
        if (pathname === "/styles.css") {
            return new Response(Bun.file("./public/styles.css"));
        }
        if (pathname === "/app.js") {
            return new Response(Bun.file("./public/app.js"));
        }

        // API Chat
        if (pathname === "/chat" && req.method === "POST") {
            try {
                const { messages, conversationId } = await req.json() as {
                    messages: ChatMessage[];
                    conversationId?: string;
                };

                const convId = conversationId || crypto.randomUUID();
                const service: any = getNextService();

                console.log(`\n🤖 Usando: ${service?.name}`);
                console.log(`📝 Conversación: ${convId}`);
                console.log(`💬 Mensajes: ${messages.length}`);

                const stream = await service.chat(messages, convId);

                // Modo Postman (no-streaming)
                if (noStream) {
                    let fullResponse = '';
                    for await (const chunk of stream) {
                        fullResponse += chunk;
                    }
                    return new Response(JSON.stringify({
                        response: fullResponse,
                        model: service.name,
                        conversationId: convId
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Modo Streaming normal
                return new Response(stream as any, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'X-Conversation-Id': convId,
                        'X-Model-Used': service.name,
                        'Access-Control-Allow-Origin': '*'
                    },
                });

            } catch (error) {
                console.error('Error en /chat:', error);
                return new Response(JSON.stringify({
                    error: 'Error procesando la solicitud'
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response("Not Found", { status: 404 });
    }
});

console.log(`\n🚀 ArlindAI corriendo en ${server.url}:${server.port}`);
console.log(`📱 Frontend: http://localhost:${server.port}`);
console.log(`🔌 API: http://localhost:${server.port}/chat`);
console.log(`🔄 Servicios disponibles: ${services.map(s => s.name).join(' | ')}`);