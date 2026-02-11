import type { ChatMessage, CacheEntry } from '../types';

class ChatCache {
    private cache: Map<string, CacheEntry> = new Map();
    private readonly TTL = 1000 * 60 * 60; // 1 hora

    private generateKey(conversationId: string, messages: ChatMessage[], modelName: string): string {
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        const key = `${conversationId}:${lastUserMessage?.content || ''}:${modelName}`;
        
        // Hash simple
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash = hash & hash;
        }
        return `${conversationId}:${hash}`;
    }

    get(conversationId: string, messages: ChatMessage[], modelName: string): string | null {
        const key = this.generateKey(conversationId, messages, modelName);
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp.getTime() > this.TTL) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.response;
    }

    set(conversationId: string, messages: ChatMessage[], modelName: string, response: string) {
        const key = this.generateKey(conversationId, messages, modelName);
        this.cache.set(key, {
            response,
            model: modelName,
            timestamp: new Date(),
            conversationId
        });
    }

    clean() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp.getTime() > this.TTL) {
                this.cache.delete(key);
            }
        }
    }
}

export const chatCache = new ChatCache();

// Limpieza automática
setInterval(() => chatCache.clean(), 1000 * 60 * 60);