// Main application for AI Writing Assistant - manages all modules and state
// Modules are loaded explicitly in view.php with version strings for visibility
import { DEFAULT_PROJECT_SCHEMA, deepClone, formatDate, createElement } from './utils.js';
import { ProjectAPI } from './api.js';
import { 
    DOMManager, 
    BubbleComponent, 
    SectionComponent, 
    TabManager, 
    ChatManager,
    quillConfig 
} from './dom.js';

// Display version information when the module loads
if (window.versionInfo) {
    console.log('Main.js module loaded');
}

// Global error handler to suppress addRange() errors from Quill
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('addRange(): The given range isn\'t in document')) {
        event.preventDefault();
        console.warn('Suppressed addRange() error from Quill editor');
        return false;
    }
});

// Central state management for the entire application
class GlobalState {
    constructor() {
        this.state = deepClone(DEFAULT_PROJECT_SCHEMA);
        this.listeners = new Map();
        this.silentMode = false; // Flag to prevent notifications during bulk updates
    }

    getState() {
        return deepClone(this.state);
    }

    setState(newState, silent = false) {
        this.state = deepClone(newState);
        if (!silent && !this.silentMode) {
            this.notifyListeners('stateChanged', this.state);
        }
    }

    updateState(updates, silent = false) {
        this.setState({ ...this.state, ...updates }, silent);
    }

    // Set silent mode for bulk operations
    setSilentMode(enabled) {
        this.silentMode = enabled;
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    notifyListeners(event, data) {
        if (this.silentMode) return;
        
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Event handler error for ${event}:`, error);
            }
        });
    }
}

// Manages project data loading, saving, and module coordination
class ProjectManager {
    constructor(globalState, api) {
        this.globalState = globalState;
        this.api = api;
        this.isReady = false;
        this.isSaving = false;
        this.lastSaveTime = null;
        this.modules = new Map(); // Keep track of registered modules for data collection
        
        this.init();
    }

    async init() {
        try {
            await this.loadProject();
            this.isReady = true;
            this.globalState.notifyListeners('ready', this.globalState.getState());
        } catch (error) {
            console.error('ProjectManager: Initialization failed:', error);
            this.globalState.notifyListeners('error', error);
        }
    }

    async loadProject() {
        try {
            const project = await this.api.loadProject();
            if (project) {
                this.globalState.setState(project);
                // Trigger 'ready' event so modules can restore their UI
                this.globalState.notifyListeners('ready', project);
            } else {
                console.warn('No existing project found, creating new one');
                this.createNewProject();
            }
        } catch (error) {
            console.error('Failed to load project:', error);
            this.createNewProject();
        }
    }

    createNewProject() {
        const newProject = deepClone(DEFAULT_PROJECT_SCHEMA);
        newProject.metadata.created = formatDate(new Date());
        newProject.metadata.modified = formatDate(new Date());
        newProject.metadata.currentTab = 'plan'; // Set default tab
        newProject.metadata.instructorInstructions = window.instructorDescription || ''; // Include instructor instructions
        
        this.globalState.setState(newProject);
        return newProject;
    }

    // Register a module so its data gets collected during save operations
    registerModule(name, module) {
        this.modules.set(name, module);
    }

    // Gather all data from registered modules and current state for saving
    collectAllData() {
        const currentState = this.globalState.getState();
        const collectedData = deepClone(currentState);
        
        // Update the modified timestamp
        collectedData.metadata.modified = formatDate(new Date());
        
        // Ask each registered module for its current data
        this.modules.forEach((module, moduleName) => {
            try {
                if (typeof module.collectData === 'function') {
                    const moduleData = module.collectData();
                    
                    // Merge the module's data into the main project data
                    if (moduleData) {
                        Object.keys(moduleData).forEach(key => {
                            if (collectedData[key]) {
                                collectedData[key] = { ...collectedData[key], ...moduleData[key] };
                            } else {
                                collectedData[key] = moduleData[key];
                            }
                        });
                    }
                }
            } catch (error) {
                console.error(`ProjectManager: Error collecting data from ${moduleName}:`, error);
            }
        });
        
        // Update metadata with current tab and instructor instructions
        if (window.aiWritingAssistant && window.aiWritingAssistant.tabManager) {
            const currentTab = window.aiWritingAssistant.tabManager.getCurrentTab();
            collectedData.metadata = { 
                ...collectedData.metadata, 
                currentTab,
                instructorInstructions: window.instructorDescription || ''
            };
        }
        
        return collectedData;
    }

    async saveProject() {
        if (this.isSaving) {
            return true;
        }

        this.isSaving = true;
        
        try {
            // Collect all data from modules and current state
            const completeProjectData = this.collectAllData();
            
            const success = await this.api.saveProject(completeProjectData);
            
            if (success) {
                this.lastSaveTime = new Date();
                this.globalState.notifyListeners('saved', completeProjectData);
                return true;
            } else {
                throw new Error('Save failed');
            }
        } catch (error) {
            console.error('ProjectManager: Failed to save project:', error);
            this.globalState.notifyListeners('error', error);
            return false;
        } finally {
            this.isSaving = false;
        }
    }

    getProject() {
        return this.globalState.getState();
    }

    // These methods are now only used for initial state loading
    // Real-time updates are removed to prevent performance issues
    updateMetadata(metadata) {
        const currentState = this.globalState.getState();
        currentState.metadata = {
            ...currentState.metadata,
            ...metadata,
            modified: formatDate(new Date())
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updatePlan(planData) {
        const currentState = this.globalState.getState();
        currentState.plan = {
            ...currentState.plan,
            ...planData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateWrite(writeData) {
        const currentState = this.globalState.getState();
        currentState.write = {
            ...currentState.write,
            ...writeData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateEdit(editData) {
        const currentState = this.globalState.getState();
        currentState.edit = {
            ...currentState.edit,
            ...editData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    updateUI(uiData) {
        const currentState = this.globalState.getState();
        currentState.ui = {
            ...currentState.ui,
            ...uiData
        };
        this.globalState.setState(currentState, true); // Silent update
    }

    async addChatMessage(role, content) {
        const currentState = this.globalState.getState();
        const message = {
            role,
            content,
            timestamp: formatDate(new Date())
        };
        
        currentState.chatHistory.push(message);
        this.globalState.setState(currentState);
        
        // Only auto-save when assistant message is received (not on user input)
        if (role === 'assistant') {
            await this.saveProject();
        }
    }


    ready() {
        return this.isReady;
    }
}

// Handles the planning phase (idea bubbles, drag & drop, and outline sections
class PlanModule {
    constructor(globalState, projectManager, api) {
        this.globalState = globalState;
        this.projectManager = projectManager;
        this.api = api;
        this.domManager = new DOMManager();
        this.bubbles = new Map(); // Track all idea bubbles by ID
        this.sections = new Map(); // Track outline sections by ID
        this.isInitialized = false;
        this.isDragging = false; // Prevent state updates during drag operations
        this.restoreTimeout = null; // Debounce state restoration
        
        // Bind event handlers to prevent duplicate listeners
        this.handleAddIdeaClick = this.handleAddIdeaClick.bind(this);
        
        // Register with project manager so our data gets saved
        this.projectManager.registerModule('plan', this);
        
        this.init();
    }

    init() {
        this.setupElements();
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.setupStateSync();
        this.loadTemplate();
        
        // Mark as initialized after template is loaded
        this.isInitialized = true;
        
        // Test bubble functionality removed
    }

    setupElements() {
        this.elements = {
            ideaBubbles: this.domManager.getElement('ideaBubbles'),
            outlineItems: this.domManager.getElement('outlineItems'),
            addIdeaBubbleBtn: this.domManager.getElement('addIdeaBubble')
        };
    }

    setupDragAndDrop() {
        if (typeof Sortable === 'undefined') {
            console.error('Sortable.js not loaded');
            return;
        }

        // Make the brainstorm panel droppable for idea bubbles
        if (this.elements.ideaBubbles) {
            new Sortable(this.elements.ideaBubbles, {
                group: {
                    name: 'bubbles',
                    pull: true,
                    put: ['bubbles']
                },
                sort: false,
                animation: 150,
                onStart: (evt) => {
                    this.isDragging = true;
                },
                onEnd: (evt) => {
                    this.isDragging = false;
                    this.handleDragEnd(evt);
                }
            });
        }
    }

    setupEventListeners() {
        if (this.elements.addIdeaBubbleBtn) {
            this.domManager.addEventListener(this.elements.addIdeaBubbleBtn, 'click', this.handleAddIdeaClick);
        }
        
        // Listen for bubble content changes - no longer update state in real-time
        document.addEventListener('bubbleContentChanged', (event) => {
            const { bubbleId, content } = event.detail;
            const bubble = this.bubbles.get(bubbleId);
            if (bubble) {
                bubble.content = content;
                // State will be updated only during save operations
            }
        });
    }

    handleAddIdeaClick() {
        this.addIdeaBubble();
    }


    setupStateSync() {
        // Only restore UI when project is initially loaded, not on every state change
        this.globalState.subscribe('ready', (state) => {
            if (this.isInitialized && state.plan && state.plan.ideas) {
                this.restoreBubblesFromState(state.plan.ideas);
            }
        });
    }

    restoreBubblesFromState(ideas) {
        if (!ideas || !Array.isArray(ideas)) return;

        // Clear existing bubbles
        this.clearAllBubbles();

        // Restore bubbles to their correct locations
        ideas.forEach(idea => {
            if (!idea.id || !idea.content) {
                console.warn('Invalid idea data:', idea);
                return;
            }

            const bubble = new BubbleComponent(idea.content, idea.id, idea.aiGenerated || false);
            this.bubbles.set(bubble.id, bubble);

            if (idea.location === 'brainstorm') {
                if (this.elements.ideaBubbles) {
                    this.elements.ideaBubbles.appendChild(bubble.element);
                }
            } else if (idea.location === 'outline' && idea.sectionId) {
                const section = this.sections.get(idea.sectionId);
                if (section) {
                    // Add bubble to the section's outline container
                    const outlineContainer = section.element.querySelector('.outline-container');
                    if (outlineContainer) {
                        outlineContainer.appendChild(bubble.element);
                        // Remove empty placeholder if it exists
                        const placeholder = outlineContainer.querySelector('.dropzone-placeholder');
                        if (placeholder) {
                            placeholder.remove();
                        }
                        outlineContainer.classList.remove('empty');
                    }
                } else {
                    console.warn('Section not found for bubble:', idea.sectionId);
                }
            } else {
                console.warn('Invalid bubble location or missing sectionId:', idea);
            }
        });
    }

    clearAllBubbles() {
        // Clear brainstorm bubbles
        if (this.elements.ideaBubbles) {
            this.elements.ideaBubbles.innerHTML = '';
        }

        // Clear outline bubbles
        this.sections.forEach(section => {
            const outlineContainer = section.element.querySelector('.outline-container');
            if (outlineContainer) {
                outlineContainer.innerHTML = '';
                // Add placeholder back
                outlineContainer.classList.add('empty');
                const placeholder = createElement('div', 'dropzone-placeholder', 'Drop ideas here to create outline items');
                placeholder.draggable = false;
                outlineContainer.appendChild(placeholder);
            }
        });

        // Clear bubbles map
        this.bubbles.clear();
    }

    handleDragEnd(evt) {
        // Update bubble locations based on where they were dropped
        const bubbleElement = evt.item;
        const bubbleId = bubbleElement.dataset.id;
        const bubble = this.bubbles.get(bubbleId);
        
        if (bubble) {
            // Determine new location
            if (evt.to === this.elements.ideaBubbles) {
                bubble.setLocation('brainstorm');
            } else {
                // Find which section this was dropped into
                const sectionElement = evt.to.closest('.template-section');
                if (sectionElement) {
                    const sectionId = sectionElement.dataset.sectionId;
                    bubble.setLocation('outline', sectionId);
                } else {
                    console.warn('Could not find section element for dropped bubble');
                }
            }
        } else {
            console.warn('Bubble not found in bubbles map:', bubbleId);
        }

        // State will be updated only during save operations
    }

    async loadTemplate() {
        try {
            const templateId = window.selectedTemplate || 'argumentative';
            const template = await this.api.loadTemplate(templateId);
            this.createSections(template.sections);
        } catch (error) {
            console.error('Failed to load template:', error);
        }
    }

    createSections(sections) {
        if (!this.elements.outlineItems) return;
        
        this.elements.outlineItems.innerHTML = '';
        
        sections.forEach(sectionData => {
            const section = new SectionComponent(sectionData);
            this.sections.set(section.id, section);
            
            // Setup drag and drop for this section
            this.setupSectionDragAndDrop(section);
            
            this.elements.outlineItems.appendChild(section.element);
        });
    }

    setupSectionDragAndDrop(section) {
        if (typeof Sortable === 'undefined') return;
        
        const outlineContainer = section.element.querySelector('.outline-container');
        if (outlineContainer) {
            new Sortable(outlineContainer, {
                group: {
                    name: 'bubbles',
                    pull: true,
                    put: ['bubbles']
                },
                sort: true,
                animation: 150,
                onStart: (evt) => {
                    this.isDragging = true;
                },
                onEnd: (evt) => {
                    this.isDragging = false;
                    this.handleDragEnd(evt);
                }
            });
        }
    }

    addIdeaBubble(content = 'New idea') {
        const bubble = new BubbleComponent(content);
        this.bubbles.set(bubble.id, bubble);
        
        if (this.elements.ideaBubbles) {
            this.elements.ideaBubbles.appendChild(bubble.element);
            bubble.element.querySelector('.bubble-content').focus();
        }
        
        // State will be updated only during save operations
    }


    // Collect current bubble data from UI elements (used only during save operations)
    collectBubbleData() {
        // Get all bubbles currently in the brainstorm panel
        const brainstormBubbles = Array.from(this.elements.ideaBubbles.children).map(bubble => ({
            id: bubble.dataset.id,
            content: bubble.querySelector('.bubble-content').textContent,
            location: 'brainstorm',
            aiGenerated: bubble.dataset.aiGenerated === 'true'
        }));

        // Get all bubbles currently in outline sections
        const outlineBubbles = [];
        this.sections.forEach(section => {
            const sectionBubbles = section.getBubbles();
            sectionBubbles.forEach(bubble => {
                outlineBubbles.push({
                    ...bubble,
                    location: 'outline',
                    sectionId: section.id
                });
            });
        });

        // Combine all bubbles into one array
        const allBubbles = [...brainstormBubbles, ...outlineBubbles];
        
        // Check for duplicate bubble IDs (shouldn't happen but good to catch)
        const bubbleIds = allBubbles.map(b => b.id);
        const uniqueIds = [...new Set(bubbleIds)];
        if (bubbleIds.length !== uniqueIds.length) {
            console.warn('Duplicate bubble IDs detected');
        }
        
        return allBubbles;
    }

    // Legacy method name for compatibility - now just collects data
    saveAllBubbles() {
        return this.collectBubbleData();
    }

    // Method called by ProjectManager to collect all plan data
    collectData() {
        // Collect current bubble data from UI elements
        const currentBubbles = this.collectBubbleData();
        
        // Collect outline structure
        const outline = [];
        this.sections.forEach(section => {
            const sectionData = {
                id: section.id,
                title: section.title,
                description: section.description,
                bubbles: section.getBubbles()
            };
            outline.push(sectionData);
        });
        
        // Get current template info
        const templateName = window.selectedTemplate || 'argumentative';
        
        const planData = {
            plan: {
                templateName: templateName,
                templateDisplayName: this.getTemplateDisplayName(templateName),
                ideas: currentBubbles,
                outline: outline,
                customSectionTitles: {},
                customSectionDescriptions: {}
            }
        };
        
        return planData;
    }

    getTemplateDisplayName(templateId) {
        const templateNames = {
            'argumentative': 'Argumentative Essay',
            'comparative': 'Comparative Essay',
            'lab-report': 'Lab Report',
            'test-template': 'Test Template'
        };
        return templateNames[templateId] || templateId;
    }

}

// ---- Base Editor Module ----
class BaseEditorModule {
    constructor(globalState, projectManager, editorId, moduleName) {
        this.globalState = globalState;
        this.projectManager = projectManager;
        this.editorId = editorId;
        this.moduleName = moduleName;
        this.editor = null;
        this.init();
    }

    init() {
        this.initializeEditor();
        this.setupEventListeners();
    }

    initializeEditor() {
        const editorContainer = document.getElementById(this.editorId);
        if (!editorContainer) return;
        
        try {
            this.editor = new Quill(`#${this.editorId}`, quillConfig);
            this.editor.format('size', '12pt');
            editorContainer.classList.add('quill-page');
            
            // No need for selection-change handling - let Quill manage selection naturally
            
            this.setupEditorEvents();
        } catch (error) {
            console.error(`Failed to initialize ${this.moduleName} editor:`, error);
        }
    }

    setupEditorEvents() {
        // No event handlers needed - Quill manages everything naturally
    }

    setupEventListeners() {
        // Only restore editor content when project is initially loaded
        this.globalState.subscribe('ready', (state) => {
            const moduleState = state[this.moduleName.toLowerCase()];
            if (moduleState && this.editor) {
                this.editor.root.innerHTML = moduleState.content || '';
            }
        });
    }

    calculateWordCount() {
        if (!this.editor) return 0;
        const text = this.editor.getText();
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }
}

// ---- Write Module ----
class WriteModule extends BaseEditorModule {
    constructor(globalState, projectManager) {
        super(globalState, projectManager, 'writeEditor', 'Write');
        
        // Register with project manager for data collection
        this.projectManager.registerModule('write', this);
    }

    handleTextChange(content) {
        // Text changes are handled locally, state updated only during save
    }

    // Method called by ProjectManager to collect all write data
    collectData() {
        const content = this.editor ? this.editor.root.innerHTML : '';
        const wordCount = this.calculateWordCount();
        
        const writeData = {
            write: {
                content: content,
                wordCount: wordCount
            }
        };
        
        return writeData;
    }
}

// ---- Edit Module ----
class EditModule extends BaseEditorModule {
    constructor(globalState, projectManager) {
        super(globalState, projectManager, 'editEditor', 'Edit');
        
        // Register with project manager for data collection
        this.projectManager.registerModule('edit', this);
    }

    handleTextChange(content) {
        // Text changes are handled locally, state updated only during save
    }

    // Method called by ProjectManager to collect all edit data
    collectData() {
        const content = this.editor ? this.editor.root.innerHTML : '';
        const currentState = this.globalState.getState();
        
        const editData = {
            edit: {
                content: content,
                suggestions: currentState.edit?.suggestions || []
            }
        };
        
        return editData;
    }
}

// ---- Main Application ----
class AIWritingAssistant {
    constructor() {
        this.globalState = new GlobalState();
        this.api = new ProjectAPI();
        this.projectManager = new ProjectManager(this.globalState, this.api);
        this.tabManager = new TabManager();
        this.chatManager = new ChatManager();
        
        this.modules = {
            plan: null,
            write: null,
            edit: null
        };
        
        this.init();
    }

    async init() {
        try {
            // Set initial activity class
            document.body.classList.add('activity-plan');
            
            // Initialize modules first so they can subscribe to events
            this.initializeModules();
            
            // Wait for project manager to be ready
            await this.waitForProjectManager();
            
            // Setup action buttons
            this.setupActionButtons();
            
            // Setup global event listeners
            this.setupGlobalEvents();
        } catch (error) {
            console.error('Failed to initialize application:', error);
        }
    }

    async waitForProjectManager() {
        if (this.projectManager.ready()) return;
        
        return new Promise((resolve) => {
            this.globalState.subscribe('ready', resolve);
        });
    }

    initializeModules() {
        this.modules.plan = new PlanModule(this.globalState, this.projectManager, this.api);
        this.modules.write = new WriteModule(this.globalState, this.projectManager);
        this.modules.edit = new EditModule(this.globalState, this.projectManager);
        
        // Register chat manager for data collection
        this.projectManager.registerModule('chat', this.chatManager);
        
        // Connect chat manager to global state for UI updates
        this.setupChatManagerConnection();
    }

    setupChatManagerConnection() {
        // Subscribe to state changes to update chat UI
        this.globalState.subscribe('stateChanged', (state) => {
            if (state.chatHistory && Array.isArray(state.chatHistory)) {
                // Only update if the chat history has actually changed
                const currentMessages = this.chatManager.getMessages();
                if (currentMessages.length !== state.chatHistory.length) {
                    this.chatManager.loadMessages(state.chatHistory);
                }
            }
        });
        
        // Also listen for the ready event to load initial chat history
        this.globalState.subscribe('ready', (state) => {
            if (state.chatHistory && Array.isArray(state.chatHistory)) {
                this.chatManager.loadMessages(state.chatHistory);
            }
        });
    }

    setupActionButtons() {
        const saveBtn = document.getElementById('saveBtn');
        const saveExitBtn = document.getElementById('saveExitBtn');
        const exitBtn = document.getElementById('exitBtn');
        
        if (saveBtn) saveBtn.addEventListener('click', () => this.handleSave());
        if (saveExitBtn) saveExitBtn.addEventListener('click', () => this.handleSaveAndExit());
        if (exitBtn) exitBtn.addEventListener('click', () => this.handleExit());
    }

    async handleSave() {
        await this._handleSaveOperation('saveBtn', false);
    }

    async handleSaveAndExit() {
        await this._handleSaveOperation('saveExitBtn', true);
    }

    async _handleSaveOperation(buttonId, shouldExit = false) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const originalText = button.innerHTML;
        
        try {
            button.disabled = true;
            button.innerHTML = 'Saving...';
            
            // Update UI state before saving
            this.updateUIState();
            
            // Use the comprehensive save method from ProjectManager
            const success = await this.projectManager.saveProject();
            
            if (success) {
                button.innerHTML = 'Saved!';
                setTimeout(() => {
                    if (shouldExit) {
                        this.handleExit();
                    } else {
                        button.innerHTML = originalText;
                        button.disabled = false;
                    }
                }, shouldExit ? 1000 : 2000);
            } else {
                this._resetButton(button, originalText);
            }
        } catch (error) {
            console.error('Save error:', error);
            this._resetButton(button, originalText);
        }
    }

    updateUIState() {
        // UI state is collected during save operations, not updated in real-time
    }

    _resetButton(button, originalText) {
        button.innerHTML = 'Save Failed';
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 3000);
    }

    handleExit() {
        const courseUrl = window.location.href.split('/mod/writeassistdev/')[0] + '/course/view.php?id=' + window.courseId;
        window.location.href = courseUrl;
    }

    setupGlobalEvents() {
        // Handle chat messages
        document.addEventListener('messageSent', (event) => {
            const { message, role } = event.detail;
            if (role === 'user') {
                this.handleUserMessage(message);
            }
        });

        // Handle regeneration requests
        document.addEventListener('regenerateRequested', (event) => {
            const { message } = event.detail;
            this.handleUserMessage(message);
        });


        // Listen for project loaded to restore UI
        this.globalState.subscribe('ready', (state) => {
            this.restoreUIFromState(state);
        });
    }

    restoreUIFromState(state) {
        // Restore chat messages
        if (state.chatHistory && Array.isArray(state.chatHistory)) {
            this.chatManager.loadMessages(state.chatHistory);
        }

        // Restore current tab
        if (state.metadata && state.metadata.currentTab) {
            this.tabManager.switchTab(state.metadata.currentTab);
        }
    }

    async handleUserMessage(message) {
        try {
            // Add user message to chat history
            await this.projectManager.addChatMessage('user', message);
            
            // Send message to AI and get response with updated project data
            const { assistantReply, updatedProject } = await this.api.sendChatMessage(message, this.projectManager.getProject());
            
            if (assistantReply) {
                await this.projectManager.addChatMessage('assistant', assistantReply);
                
                // If the AI returned an updated project, merge it with current state
                if (updatedProject) {
                    const currentState = this.globalState.getState();
                    
                    // Merge the updated project data (particularly ideas and other AI modifications)
                    if (updatedProject.plan && updatedProject.plan.ideas) {
                        currentState.plan = currentState.plan || {};
                        currentState.plan.ideas = updatedProject.plan.ideas;
                    }
                    
                    // Update the global state and save
                    this.globalState.setState(currentState);
                    await this.projectManager.saveProject();
                }
            } else {
                const errorMsg = 'Sorry, I couldn\'t connect to the AI service. Please make sure the AI Writing Assistant API server is running.';
                await this.projectManager.addChatMessage('assistant', errorMsg);
            }
        } catch (error) {
            console.error('Failed to handle user message:', error);
            const errorMsg = 'Sorry, I couldn\'t connect to the AI service. Please make sure the AI Writing Assistant API server is running.';
            await this.projectManager.addChatMessage('assistant', errorMsg);
        }
    }
}

// ---- Application Initialization ----
function initializeApp() {
    try {
        window.aiWritingAssistant = new AIWritingAssistant();
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Global function to check version information (call from browser console)
window.checkVersions = function() {
    if (window.versionInfo) {
        console.log('Plugin Version:', window.versionInfo.plugin_version);
        return window.versionInfo;
    } else {
        console.log('Version information not available');
        return null;
    }
};

// ---- Exports ----
export { 
    AIWritingAssistant, 
    ProjectManager, 
    PlanModule, 
    BaseEditorModule,
    WriteModule, 
    EditModule,
    GlobalState 
};
