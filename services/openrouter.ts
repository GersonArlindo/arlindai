// services/openrouter.ts - VERSIÓN FINAL CON FALLBACK
import type { AIService, ChatMessage } from '../types';
import { chatCache } from './cache';

// 📋 LISTA COMPLETA DE MODELOS GRATUITOS CONFIRMADOS (ordenados por prioridad)
const FREE_MODELS: any = [
    // 🥇 PRIORIDAD 1: Los más estables y capaces
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    
    // 🥈 PRIORIDAD 2: Excelentes alternativas
    'qwen/qwen3-coder:free',
    'deepseek/deepseek-r1-0528:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    
    // 🥉 PRIORIDAD 3: Rápidos y livianos (fallback final)
    'stepfun/step-3.5-flash:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
    'google/gemma-3-12b-it:free',
];

// ⏱️ Timeout para cada intento (15 segundos)
const TIMEOUT_MS = 15000;

export const openRouterService: AIService = {
    name: 'OpenRouter (Auto-Fallback)',
    
    async chat(messages: ChatMessage[], conversationId?: string): Promise<AsyncGenerator<string>> {
        // Verificar caché primero
        if (conversationId) {
            const cached = chatCache.get(conversationId, messages, this.name);
            if (cached) {
                console.log(`🎯 OpenRouter: Cache hit`);
                return (async function* () { yield cached; })();
            }
        }

        // Intentar cada modelo hasta que uno funcione
        let lastError = null;
        for (const model of FREE_MODELS) {
            try {
                console.log(`🔄 OpenRouter: Intentando con ${model.split('/')[1]}...`);
                
                const generator = await tryModelWithTimeout(model, messages, conversationId);
                
                // Si llegamos aquí, el modelo funcionó
                console.log(`✅ OpenRouter: Usando ${model}`);
                
                // Actualizar el nombre del servicio para mostrar el modelo actual
                this.name = `OpenRouter (${model.split('/')[1].replace(':free', '')})`;
                
                return generator;
                
            } catch (error: any) {
                lastError = error;
                console.log(`❌ OpenRouter: Falló ${model} - ${error.message || error}`);
                // Continuar con el siguiente modelo
            }
        }

        // Si TODOS los modelos fallaron
        console.error('🚨 OpenRouter: Todos los modelos fallaron', lastError);
        return (async function* () {
            yield '⚠️ Servicio OpenRouter temporalmente no disponible. Los otros servicios siguen funcionando.';
        })();
    }
};

/**
 * Intenta un modelo específico con timeout
 */
async function tryModelWithTimeout(
    model: string, 
    messages: ChatMessage[], 
    conversationId?: string
): Promise<AsyncGenerator<string>> {
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout después de ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        try {
            const generator = await callOpenRouterModel(model, messages, conversationId);
            clearTimeout(timeoutId);
            resolve(generator);
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * Llama a un modelo específico de OpenRouter
 */
async function callOpenRouterModel(
    model: string,
    messages: ChatMessage[],
    conversationId?: string
): Promise<AsyncGenerator<string>> {
    const controller = new AbortController();
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                'X-Title': 'ArlindAI',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true,
                max_tokens: 4096,
                temperature: 0.7,
                top_p: 0.95,
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
        }

        if (!response.body) {
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        const generator = async function* () {
            let fullResponse = '';
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    yield content;
                                }
                            } catch (e) {
                                // Ignorar JSON malformados
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }

            // Guardar en caché si tenemos respuesta completa
            if (conversationId && fullResponse) {
                chatCache.set(conversationId, messages, `OpenRouter-${model}`, fullResponse);
            }
        };

        return generator();

    } catch (error) {
        controller.abort();
        throw error;
    }
}