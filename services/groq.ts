import { Groq } from 'groq-sdk';
import type { AIService, ChatMessage } from '../types';
import { chatCache } from './cache';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export const groqService: AIService = {
    name: 'Groq (Moonshotai)',
    async chat(messages: ChatMessage[], conversationId?: string): Promise<AsyncGenerator<string>> {
        // Verificar caché primero
        if (conversationId) {
            const cached = chatCache.get(conversationId, messages, this.name);
            if (cached) {
                console.log(`🎯 Cache hit para ${this.name}`);
                return (async function* () {
                    yield cached;
                })();
            }
        }

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages,
                model: "moonshotai/kimi-k2-instruct-0905",
                temperature: 0.6,
                max_completion_tokens: 4096,
                top_p: 1,
                stream: true,
                stop: null
            });

            const generator = async function* () {
                let fullResponse = '';
                
                for await (const chunk of chatCompletion) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    fullResponse += content;
                    yield content;
                }
                
                // Guardar en caché después de completar
                if (conversationId && fullResponse) {
                    chatCache.set(conversationId, messages, groqService.name, fullResponse);
                }
            };

            return generator();
            
        } catch (error) {
            console.error('Error en Groq:', error);
            // Fallback: devolver un generador con mensaje de error
            return (async function* () {
                yield '⚠️ Error en el servicio Groq. Intenta de nuevo.';
            })();
        }
    }
};