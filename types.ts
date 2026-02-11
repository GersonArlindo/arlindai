export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface Conversation {
    id: string;
    messages: ChatMessage[];
    createdAt: Date;
}

export interface CacheEntry {
    response: string;
    model: string;
    timestamp: Date;
    conversationId: string;
}

export interface AIService {
    name: string;
    chat(messages: ChatMessage[], conversationId?: string): Promise<AsyncGenerator<string>>;
}