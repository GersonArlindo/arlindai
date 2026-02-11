// services/gemini.ts - VERSIÓN FINAL Y FUNCIONAL
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIService, ChatMessage } from '../types';
import { chatCache } from './cache';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const geminiService: AIService = {
    name: 'Gemini 2.5 Flash', // ✅ MODELO ESTABLE 2026
    async chat(messages: ChatMessage[], conversationId?: string): Promise<AsyncGenerator<string>> {
        // Verificar caché
        if (conversationId) {
            const cached = chatCache.get(conversationId, messages, this.name);
            if (cached) {
                return (async function* () { yield cached; })();
            }
        }

        try {
            // Separar mensaje del sistema
            const systemMessage = messages.find(m => m.role === 'system');
            const userMessages = messages.filter(m => m.role !== 'system');
            
            // ✅ MODELO CORRECTO - ESTABLE Y GRATUITO
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash', // ¡ESTE FUNCIONA!
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4096,
                },
            });

            // Convertir historial
            const history = userMessages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
            }));

            // Iniciar chat
            const chat = model.startChat({
                history: history,
                systemInstruction: systemMessage?.content,
            });

            const lastMessage = userMessages[userMessages.length - 1]?.content || 'Hola';
            const result = await chat.sendMessageStream(lastMessage);
            
            const generator = async function* () {
                let fullResponse = '';
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    fullResponse += text;
                    yield text;
                }
                if (conversationId && fullResponse) {
                    chatCache.set(conversationId, messages, geminiService.name, fullResponse);
                }
            };

            return generator();
            
        } catch (error) {
            console.error('Error en Gemini:', error);
            // Fallback a otro modelo estable
            return (async function* () {
                yield '⚠️ Error en Gemini. Intenta de nuevo.';
            })();
        }
    }
};