// DOM manipulation and UI components for the writing assistant
import { createElement, generateId } from './utils.js';

// Display version information when the module loads
if (window.versionInfo) {
    console.log('DOM.js module loaded');
}

// Configure Quill editor with custom font sizes and toolbar options
const Size = Quill.import('attributors/style/size');
Size.whitelist = ['8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'];
Quill.register(Size, true);

export const quillConfig = {
    theme: 'snow',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ 'header': 1 }, { 'header': 2 }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'script': 'sub'}, { 'script': 'super' }],
            [{ 'indent': '-1'}, { 'indent': '+1' }],
            [{ 'direction': 'rtl' }],
            [{ 'size': ['8pt', '10pt', '12pt', '14pt', '16pt', '18pt', '24pt', '36pt'] }],
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'font': [] }],
            [{ 'align': [] }],
            ['clean']
        ]
    }
};

// Manages DOM elements and event listeners to prevent memory leaks
export class DOMManager {
    constructor() {
        this.elements = {}; // Cache for frequently accessed elements
        this.eventListeners = new Map(); // Track event listeners for cleanup
    }

    // Get DOM element by ID, with caching to avoid repeated queries
    getElement(id, selector = null) {
        return this.elements[id] ||= selector ? document.querySelector(selector) : document.getElementById(id);
    }

    // Clear the element cache (useful for dynamic content)
    clearCache() {
        this.elements = {};
    }

    // Add event listener with duplicate prevention
    addEventListener(element, event, handler, options = {}) {
        if (!element) return;
        
        const key = `${element.id || 'unknown'}_${event}`;
        const handlers = this.eventListeners.get(key) || [];
        
        // Only add if not already added (prevents duplicate listeners)
        if (!handlers.includes(handler)) {
            handlers.push(handler);
            this.eventListeners.set(key, handlers);
            element.addEventListener(event, handler, options);
        }
    }

    removeEventListeners(element, event = null) {
        const key = event ? `${element.id || 'unknown'}_${event}` : element.id || 'unknown';
        const handlers = this.eventListeners.get(key);
        
        if (handlers) {
            handlers.forEach(handler => element.removeEventListener(event, handler));
            this.eventListeners.delete(key);
        }
    }

    cleanup() {
        this.eventListeners.forEach((handlers, key) => {
            const [elementId, event] = key.split('_');
            const element = this.getElement(elementId);
            handlers.forEach(handler => element?.removeEventListener(event, handler));
        });
        this.eventListeners.clear();
    }
}

// Represents a draggable idea bubble that can be moved between brainstorm and outline
export class BubbleComponent {
    constructor(content = 'New idea', id = null, aiGenerated = false) {
        this.id = id || generateId();
        this.content = content;
        this.aiGenerated = aiGenerated;
        this.element = this.createBubble();
    }

    createBubble() {
        const bubble = createElement('div', 'idea-bubble');
        bubble.dataset.id = this.id;
        
        // Add AI-generated class if applicable
        if (this.aiGenerated) {
            bubble.classList.add('ai-generated');
            bubble.dataset.aiGenerated = 'true';
        }
        
        const contentDiv = createElement('div', 'bubble-content', this.content);
        const deleteBtn = createElement('button', 'delete-bubble-btn', '×');
        
        bubble.appendChild(contentDiv);
        bubble.appendChild(deleteBtn);
        
        // Make content editable only if not AI-generated
        if (!this.aiGenerated) {
            contentDiv.contentEditable = true;
            
            // Add event listener for content changes
            contentDiv.addEventListener('input', () => {
                this.content = contentDiv.textContent;
                // Emit custom event for content change
                bubble.dispatchEvent(new CustomEvent('bubbleContentChanged', {
                    detail: { bubbleId: this.id, content: this.content }
                }));
            });
        } else {
            // Add AI label for AI-generated bubbles
            const aiLabel = createElement('span', 'ai-label', 'AI');
            contentDiv.appendChild(aiLabel);
        }
        
        return bubble;
    }

    setContent(content) {
        this.content = content;
        const contentDiv = this.element.querySelector('.bubble-content');
        if (contentDiv) {
            contentDiv.textContent = content;
        }
    }

    getContent() {
        const contentDiv = this.element.querySelector('.bubble-content');
        return contentDiv ? contentDiv.textContent : this.content;
    }

    setLocation(location, sectionId = null) {
        this.element.dataset.location = location;
        if (sectionId) {
            this.element.dataset.sectionId = sectionId;
        }
    }

    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

export class SectionComponent {
    constructor(sectionData) {
        this.id = sectionData.id;
        this.title = sectionData.title;
        this.description = sectionData.description;
        this.element = this.createSection();
    }

    createSection() {
        const sectionDiv = createElement('div', 'template-section');
        sectionDiv.dataset.sectionId = this.id;
        
        const sectionHeader = createElement('div', 'section-header');
        const sectionTitle = createElement('h4', 'section-title', this.title);
        sectionTitle.contentEditable = true;
        sectionTitle.dataset.sectionId = this.id;
        
        sectionHeader.appendChild(sectionTitle);
        sectionDiv.appendChild(sectionHeader);
        
        // Add section description if it exists
        if (this.description) {
            const sectionDescription = createElement('p', 'section-description', this.description);
            sectionDiv.appendChild(sectionDescription);
        }
        
        const outlineContainer = createElement('div', 'outline-container outline-dropzone');
        outlineContainer.dataset.sectionId = this.id;
        
        // Add dropzone placeholder text when empty
        outlineContainer.classList.add('empty');
        const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
        placeholder.draggable = false;
        outlineContainer.appendChild(placeholder);
        
        sectionDiv.appendChild(outlineContainer);
        
        return sectionDiv;
    }

    addBubble(bubble) {
        const outlineContainer = this.element.querySelector('.outline-container');
        if (outlineContainer) {
            // Remove placeholder if it exists
            if (outlineContainer.classList.contains('empty')) {
                outlineContainer.classList.remove('empty');
                outlineContainer.innerHTML = '';
            }
            outlineContainer.appendChild(bubble.element);
        }
    }

    removeBubble(bubbleId) {
        const bubble = this.element.querySelector(`[data-id="${bubbleId}"]`);
        if (bubble) {
            bubble.remove();
            
            // Add placeholder back if no bubbles remain
            const outlineContainer = this.element.querySelector('.outline-container');
            if (outlineContainer && outlineContainer.children.length === 0) {
                outlineContainer.classList.add('empty');
                const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
                placeholder.draggable = false;
                outlineContainer.appendChild(placeholder);
            }
        }
    }

    getBubbles() {
        const outlineContainer = this.element.querySelector('.outline-container');
        if (!outlineContainer) return [];
        
        return Array.from(outlineContainer.querySelectorAll('.idea-bubble')).map(bubble => ({
            id: bubble.dataset.id,
            content: bubble.querySelector('.bubble-content').textContent,
            aiGenerated: bubble.dataset.aiGenerated === 'true'
        }));
    }

    setTitle(title) {
        this.title = title;
        const titleElement = this.element.querySelector('.section-title');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// ---- Tab Management ----
// Manages tab switching between plan, write, and edit modes
export class TabManager {
    constructor() {
        this.currentTab = 'plan';
        this.tabs = new Map(); // Store tab elements for quick access
        this.init();
    }

    init() {
        this.setupTabButtons();
        this.setupTabContent();
    }

    setupTabButtons() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            const tabId = button.dataset.tab;
            this.tabs.set(tabId, button);
            
            button.addEventListener('click', () => {
                this.switchTab(tabId);
            });
        });
    }

    setupTabContent() {
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            const tabId = content.id;
            if (tabId) {
                this.tabs.set(`${tabId}_content`, content);
            }
        });
    }

    switchTab(tabId) {
        // Update tab active state
        this.tabs.forEach((element, key) => {
            if (key === tabId) {
                element.classList.add('active');
            } else if (key.endsWith('_content')) {
                element.classList.remove('active');
            } else {
                element.classList.remove('active');
            }
        });

        // Update tab content visibility
        const contentKey = `${tabId}_content`;
        if (this.tabs.has(contentKey)) {
            this.tabs.get(contentKey).classList.add('active');
        }

        // Update body class for activity-based styling
        document.body.classList.remove('activity-plan', 'activity-write', 'activity-edit');
        document.body.classList.add(`activity-${tabId}`);

        this.currentTab = tabId;
        
        // Update metadata in global state if available
        if (window.aiWritingAssistant && window.aiWritingAssistant.globalState) {
            const currentState = window.aiWritingAssistant.globalState.getState();
            if (currentState.metadata) {
                currentState.metadata.currentTab = tabId;
                window.aiWritingAssistant.globalState.setState(currentState, true); // Silent update
            }
        }
        
        // Emit custom event for tab change
        document.dispatchEvent(new CustomEvent('tabChanged', {
            detail: { tabId, previousTab: this.currentTab }
        }));
    }

    getCurrentTab() {
        return this.currentTab;
    }
}

// Handles chat interface for AI interactions
export class ChatManager {
    constructor() {
        this.messages = []; // Store chat message history
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            userInput: document.getElementById('userInput'),
            sendButton: document.getElementById('sendMessage'),
            regenerateGlobalBtn: document.getElementById('regenerateGlobalBtn')
        };
        
        // Check if elements were found
        if (!this.elements.chatMessages || !this.elements.userInput || !this.elements.sendButton) {
            console.warn('ChatManager: Some required elements not found');
        }
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.userInput) {
            this.elements.userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }


        if (this.elements.regenerateGlobalBtn) {
            this.elements.regenerateGlobalBtn.addEventListener('click', () => this.regenerateLastMessage());
        }
    }

    addMessage(role, content, timestamp = null) {
        const message = {
            id: generateId(),
            role,
            content,
            timestamp: timestamp || new Date().toISOString()
        };
        
        this.messages.push(message);
        this.renderMessage(message);
        this.updateRegenerateButton();
        
        return message;
    }

    renderMessage(message) {
        if (!this.elements.chatMessages) {
            console.error('ChatManager: chatMessages element not found, cannot render message');
            return;
        }
        
        const messageDiv = createElement('div', `message ${message.role}`);
        const messageContent = createElement('div', 'message-content', message.content);
        
        messageDiv.appendChild(messageContent);
        this.elements.chatMessages.appendChild(messageDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    sendMessage() {
        if (!this.elements.userInput) return;
        
        const message = this.elements.userInput.value.trim();
        if (!message) return;
        
        // Don't add message directly - let the global state system handle it
        this.elements.userInput.value = '';
        
        // Emit custom event for message sent
        document.dispatchEvent(new CustomEvent('messageSent', {
            detail: { message, role: 'user' }
        }));
    }


    regenerateLastMessage() {
        if (this.messages.length < 2) return;
        
        const last = this.messages[this.messages.length - 1];
        const prev = this.messages[this.messages.length - 2];
        
        if (last.role !== 'assistant' || prev.role !== 'user') return;
        
        // Remove last AI message
        this.messages.pop();
        if (this.elements.chatMessages.lastChild) {
            this.elements.chatMessages.removeChild(this.elements.chatMessages.lastChild);
        }
        
        // Emit custom event for regeneration
        document.dispatchEvent(new CustomEvent('regenerateRequested', {
            detail: { message: prev.content }
        }));
    }

    updateRegenerateButton() {
        if (!this.elements.regenerateGlobalBtn) return;
        
        const last = this.messages[this.messages.length - 1];
        this.elements.regenerateGlobalBtn.disabled = !(last && last.role === 'assistant');
    }

    loadMessages(messages) {
        // Check if DOM elements are available, re-initialize if needed
        if (!this.elements.chatMessages) {
            console.warn('ChatManager: Reinitializing elements as chatMessages was not found');
            this.elements.chatMessages = document.getElementById('chatMessages');
        }
        
        // Clear existing messages without triggering clear event
        this.messages = [];
        if (this.elements.chatMessages) {
            this.elements.chatMessages.innerHTML = '';
        } else {
            console.error('ChatManager: chatMessages element still not found after reinit, cannot clear messages');
            return; // Don't try to load messages if we can't render them
        }
        this.updateRegenerateButton();
        
        // Load new messages
        if (messages && Array.isArray(messages)) {
            messages.forEach((msg, index) => {
                this.addMessage(msg.role, msg.content, msg.timestamp);
            });
        } else {
            console.warn('ChatManager: Invalid messages array');
        }
    }

    getMessages() {
        return [...this.messages];
    }

    // Method called by ProjectManager to collect chat data
    collectData() {
        const chatData = {
            chatHistory: this.getMessages()
        };
        
        return chatData;
    }
}


