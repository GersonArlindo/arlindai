import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { AIService, ChatMessage } from '../types';
import { chatCache } from './cache';

const cerebras = new Cerebras({
    apiKey: process.env.CEREBRAS_API_KEY
});

export const cerebrasService: AIService = {
    name: 'Cerebras (OPEN AI GPT OSS)',
    async chat(messages: ChatMessage[], conversationId?: string): Promise<AsyncGenerator<string>> {
        // Verificar caché
        if (conversationId) {
            const cached = chatCache.get(conversationId, messages, this.name);
            if (cached) {
                return (async function* () {
                    yield cached;
                })();
            }
        }

        try {
            const chatCompletion = await cerebras.chat.completions.create({
                messages: messages as any,
                model: 'gpt-oss-120b',
                stream: true,
                max_completion_tokens: 32768,
                temperature: 1,
                top_p: 1,
                reasoning_effort: "medium"
            });

            const generator = async function* () {
                let fullResponse = '';

                for await (const chunk of chatCompletion) {
                    const content = (chunk as any).choices[0]?.delta?.content || '';
                    fullResponse += content;
                    yield content;
                }

                if (conversationId && fullResponse) {
                    chatCache.set(conversationId, messages, cerebrasService.name, fullResponse);
                }
            };

            return generator();

        } catch (error) {
            console.error('Error en Cerebras:', error);
            return (async function* () {
                yield '⚠️ Error en el servicio Cerebras. Intenta de nuevo.';
            })();
        }
    }
};