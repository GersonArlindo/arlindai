// Estado de la aplicación
let userId = localStorage.getItem('arlindai_user_id');
if (!userId) {
    userId = prompt('Ingresa tu nombre de usuario:') || 'usuario_' + crypto.randomUUID().slice(0, 8);
    localStorage.setItem('arlindai_user_id', userId);
}

let currentConversationId = localStorage.getItem(`${userId}_current_conv`) || crypto.randomUUID();
let conversations = JSON.parse(localStorage.getItem(`${userId}_conversations`) || '{}');
let currentModel = '';
let isStreaming = false;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userId').textContent = userId; // Añade esto al HTML
    document.getElementById('conversationId').textContent = currentConversationId;
    loadConversationsList();
    loadMessages();
});

// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Nueva conversación
function newConversation() {
    currentConversationId = crypto.randomUUID();
    localStorage.setItem(`${userId}_current_conv`, currentConversationId);
    document.getElementById('conversationId').textContent = currentConversationId;
    document.getElementById('currentConversationTitle').textContent = 'Nueva conversación';
    document.getElementById('messagesContainer').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">✨</div>
            <h3>Bienvenido a BrightFutureAI</h3>
            <p>Tu chat inteligente con múltiples modelos de IA. 
               Cada mensaje usa un modelo diferente automáticamente.</p>
            <div class="features">
                       <span>🚀 Groq</span>
                        <span>⚡ Cerebras</span>
                        <span>🤖 Gemini</span>
                        <span>🔄 OpenRouter</span>
                        <span>💾 Caché por conversación</span>
            </div>
        </div>
    `;
    loadConversationsList();
}

// Cargar lista de conversaciones
function loadConversationsList() {
    const list = document.getElementById('conversationsList');
    const convs = JSON.parse(localStorage.getItem(`${userId}_conversations`) || '{}');

    let html = '';
    Object.keys(convs).slice(-5).reverse().forEach(id => {
        const conv = convs[id];
        html += `
            <div class="conversation-item ${id === currentConversationId ? 'active' : ''}" 
                 onclick="switchConversation('${id}')">
                <div class="conversation-title">${conv.title || 'Conversación'}</div>
                <div class="conversation-preview">${conv.preview || 'Sin mensajes'}</div>
            </div>
        `;
    });

    list.innerHTML = html || '<div style="color: var(--text-secondary); text-align: center;">No hay conversaciones</div>';
}

// Cambiar de conversación
function switchConversation(id) {
    currentConversationId = id;
    localStorage.setItem('arlindai_current_conv', id);
    document.getElementById('conversationId').textContent = id;
    loadMessages();
    loadConversationsList();
}

// Cargar mensajes de la conversación actual
function loadMessages() {
    const convs = JSON.parse(localStorage.getItem(`${userId}_conversations`) || '{}');
    const conversation = convs[currentConversationId];
    const container = document.getElementById('messagesContainer');

    if (!conversation || !conversation.messages || conversation.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">✨</div>
                <h3>Bienvenido a BrightFutureAI</h3>
                <p>Tu chat inteligente con múltiples modelos de IA.</p>
                <div class="features">
                    <span>🚀 Groq</span>
                    <span>⚡ Cerebras</span>
                    <span>💾 Caché por conversación</span>
                </div>
            </div>
        `;
        return;
    }

    let html = '';
    conversation.messages.forEach(msg => {
        html += `
            <div class="message ${msg.role === 'user' ? 'user' : 'ai'}">
                <div class="message-content">
                    ${msg.content}
                    <div class="message-model">${msg.model || 'ArlindAI'}</div>
                    <div class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// Enviar mensaje
async function sendMessage() {
    if (isStreaming) return;

    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    // Agregar mensaje del usuario al UI
    addMessageToUI('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Mostrar indicador de escritura
    showTypingIndicator();

    isStreaming = true;
    document.getElementById('sendButton').disabled = true;

    try {
        // Obtener historial de la conversación
        const convs = JSON.parse(localStorage.getItem('arlindai_conversations') || '{}');
        const conversation = convs[currentConversationId] || { messages: [] };

        const messages = [
            ...conversation.messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: message }
        ];

        // Llamar a la API
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                conversationId: currentConversationId
            })
        });

        if (!response.ok) throw new Error('Error en la respuesta');

        // Obtener headers
        const modelUsed = response.headers.get('X-Model-Used') || 'ArlindAI';
        document.getElementById('currentModelTag').innerHTML = `
            <span style="color: var(--accent); font-weight: 600;">⚡</span> ${modelUsed}
        `;

        // Leer el stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';

        // Crear contenedor para respuesta del AI
        const aiMessageDiv = createAIMessageContainer();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            aiResponse += chunk;

            // Actualizar UI en tiempo real
            const contentDiv = aiMessageDiv.querySelector('.message-content');
            contentDiv.innerHTML = `
                ${aiResponse}
                <div class="message-model">${modelUsed}</div>
                <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
            `;

            document.getElementById('messagesContainer').scrollTop =
                document.getElementById('messagesContainer').scrollHeight;
        }

        // Quitar indicador de escritura
        removeTypingIndicator();

        // Guardar en localStorage
        saveConversation(message, aiResponse, modelUsed);

    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessageToUI('ai', '❌ Error al conectar con el servidor');
    } finally {
        isStreaming = false;
        document.getElementById('sendButton').disabled = false;
    }
}

// Agregar mensaje al UI
function addMessageToUI(role, content, model = '') {
    const container = document.getElementById('messagesContainer');
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            ${content}
            ${role === 'ai' ? `<div class="message-model">${model}</div>` : ''}
            <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
        </div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Crear contenedor para respuesta del AI (streaming)
function createAIMessageContainer() {
    const container = document.getElementById('messagesContainer');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;

    return messageDiv;
}

// Mostrar indicador de escritura
function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const indicator = document.createElement('div');
    indicator.className = 'message ai';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
}

// Quitar indicador de escritura
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// Guardar conversación en localStorage
function saveConversation(userMessage, aiResponse, modelUsed) {
    const convs = JSON.parse(localStorage.getItem(`${userId}_conversations`) || '{}');

    if (!convs[currentConversationId]) {
        convs[currentConversationId] = {
            title: userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : ''),
            preview: aiResponse.slice(0, 50) + '...',
            messages: [],
            createdAt: new Date().toISOString()
        };
    }

    const conversation = convs[currentConversationId];

    // Agregar mensajes
    conversation.messages.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
    });

    conversation.messages.push({
        role: 'assistant',
        content: aiResponse,
        model: modelUsed,
        timestamp: new Date().toISOString()
    });

    // Actualizar preview
    conversation.preview = aiResponse.slice(0, 50) + '...';

    localStorage.setItem(`${userId}_conversations`, JSON.stringify(convs));
    loadConversationsList();
}

function changeUser() {
    if (confirm('¿Cambiar de usuario? Se cerrará la sesión actual.')) {
        localStorage.removeItem('arlindai_user_id');
        location.reload();
    }
}

// Manejar teclas
document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Model badges
const models = ['Groq', 'Cerebras', 'Gemini', 'OpenRouter'];
const badgesContainer = document.getElementById('modelBadges');
badgesContainer.innerHTML = models.map(m =>
    `<span class="model-badge">${m}</span>`
).join('');