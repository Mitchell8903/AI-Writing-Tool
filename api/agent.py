import os
import json
from typing import Dict, List, Any, Optional
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from langchain.tools import BaseTool
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from pydantic import BaseModel, Field


class AddIdeaInput(BaseModel):
    """Input for adding an idea to the brainstorm list."""
    idea: str = Field(description="The idea to add to the brainstorm list")


class AddCommentInput(BaseModel):
    """Input for adding a comment to the quill editor content."""
    content: str = Field(description="The quill editor content with HTML comment attributes added")
    comment_text: str = Field(description="The comment text to add")


class AddIdeaTool(BaseTool):
    """Tool for adding ideas to the brainstorm list."""
    name: str = "add_idea"
    description: str = "Add an idea to the brainstorm ideas list. Use this when the user suggests or mentions a new idea that should be captured."
    args_schema: type = AddIdeaInput

    def _run(self, idea: str) -> str:
        """Add an idea to the brainstorm list."""
        return f"Idea '{idea}' has been added to the brainstorm list."


class AddCommentTool(BaseTool):
    """Tool for adding comments to quill editor content."""
    name: str = "add_comment"
    description: str = "Add comments to the quill editor content. Use this when you want to add editorial comments or suggestions to the written content."
    args_schema: type = AddCommentInput

    def _run(self, content: str, comment_text: str) -> str:
        """Add a comment to the quill editor content."""
        return f"Comment '{comment_text}' has been added to the content."


class WritingAgent:
    """LangChain-based writing agent with phase-specific system prompts and tools."""
    
    def __init__(self):
        """Initialize the writing agent with OpenAI model and tools."""
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Initialize tools
        self.tools = [AddIdeaTool(), AddCommentTool()]
        
        # System prompts for each phase
        self.system_prompts = {
            "plan_organize": """You are an AI writing assistant in the Plan & Organize phase. Your role is to help users:

1. **Brainstorm and generate ideas** for their writing project
2. **Organize and structure** their thoughts and ideas
3. **Create outlines** and planning documents
4. **Identify key themes** and arguments
5. **Suggest research directions** and sources

**Phase Guidelines:**
- Focus on idea generation and organization
- Help users think through their topic from multiple angles
- Encourage exploration of different perspectives
- Suggest when to move to the Write phase (when ideas are well-organized and outline is clear)
- Be creative and open-ended in your suggestions

**When to suggest moving to Write phase:**
- User has a clear outline or structure
- Main ideas and arguments are identified
- Research direction is established
- User feels ready to start writing

**When to suggest revisiting this phase:**
- Ideas seem scattered or unfocused
- User is struggling with organization
- New ideas keep emerging that need integration""",

            "write": """You are an AI writing assistant in the Write phase. Your role is to help users:

1. **Generate actual content** based on their planning
2. **Maintain focus** on their outline and structure
3. **Develop ideas** into full paragraphs and sections
4. **Ensure coherence** and flow between sections
5. **Provide writing support** and encouragement

**Phase Guidelines:**
- Focus on content creation and development
- Help users expand their ideas into full text
- Maintain consistency with their planning
- Encourage progress while maintaining quality
- Suggest when to move to Edit & Revise phase (when draft is complete)
- Be supportive and constructive

**When to suggest moving to Edit & Revise phase:**
- First draft is complete
- All planned sections are written
- User has a full document to work with
- Content covers all main points

**When to suggest revisiting Plan & Organize phase:**
- User is struggling with structure while writing
- New ideas emerge that require planning
- Content is becoming unfocused or scattered
- Major reorganization is needed""",

            "edit_revise": """You are an AI writing assistant in the Edit & Revise phase. Your role is to help users:

1. **Review and improve** existing content
2. **Identify areas** for revision and enhancement
3. **Suggest specific edits** and improvements
4. **Check for clarity** and coherence
5. **Polish and refine** the writing

**Phase Guidelines:**
- Focus on improvement and refinement
- Provide specific, actionable feedback
- Help identify strengths and weaknesses
- Suggest concrete revisions
- Encourage iterative improvement
- Suggest when content is ready for final review

**When to suggest the work is complete:**
- Content is clear and well-organized
- All major issues have been addressed
- User is satisfied with the quality
- Ready for submission or publication

**When to suggest revisiting Write phase:**
- Major content gaps are identified
- Significant rewriting is needed
- New sections or ideas require development
- Structure needs substantial changes"""
        }
        
        # Create agent executors for each phase
        self.agents = {}
        for phase, system_prompt in self.system_prompts.items():
            self.agents[phase] = self._create_agent(phase, system_prompt)
    
    def _create_agent(self, phase: str, system_prompt: str) -> AgentExecutor:
        """Create an agent executor for a specific phase."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad")
        ])
        
        agent = create_openai_tools_agent(self.llm, self.tools, prompt)
        return AgentExecutor(agent=agent, tools=self.tools, verbose=True)
    
    def _extract_chat_history(self, project: Dict[str, Any]) -> List:
        """Extract chat history from project JSON and convert to LangChain messages."""
        chat_history = []
        
        # Get chat history from project
        if "chatHistory" in project and project["chatHistory"]:
            for message in project["chatHistory"]:
                if message.get("role") == "user":
                    chat_history.append(HumanMessage(content=message.get("content", "")))
                elif message.get("role") == "assistant":
                    chat_history.append(AIMessage(content=message.get("content", "")))
        
        return chat_history
    
    def _get_current_phase(self, project: Dict[str, Any]) -> str:
        """Determine the current phase based on project state."""
        # Default to plan_organize if no phase is specified
        current_phase = project.get("currentPhase", "plan_organize")
        
        # Validate phase
        if current_phase not in self.system_prompts:
            current_phase = "plan_organize"
        
        return current_phase
    
    def _create_project_context(self, project: Dict[str, Any]) -> str:
        """Create context string from project data (excluding chat history)."""
        context_parts = []
        
        # Add project title if available
        if "title" in project and project["title"]:
            context_parts.append(f"Project Title: {project['title']}")
        
        # Add project description if available
        if "description" in project and project["description"]:
            context_parts.append(f"Project Description: {project['description']}")
        
        # Add brainstorm ideas if available
        if "brainstormIdeas" in project and project["brainstormIdeas"]:
            ideas = project["brainstormIdeas"]
            if isinstance(ideas, list) and ideas:
                context_parts.append(f"Current Brainstorm Ideas: {', '.join(ideas)}")
        
        # Add outline if available
        if "outline" in project and project["outline"]:
            context_parts.append(f"Current Outline: {project['outline']}")
        
        # Add written content if available
        if "content" in project and project["content"]:
            content = project["content"]
            # Truncate very long content for context
            if len(content) > 1000:
                content = content[:1000] + "..."
            context_parts.append(f"Current Content: {content}")
        
        # Add current phase
        current_phase = self._get_current_phase(project)
        context_parts.append(f"Current Phase: {current_phase.replace('_', ' ').title()}")
        
        return "\n".join(context_parts) if context_parts else "No additional context available."
    
    def process_chat_message(self, user_input: str, project: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        """Process a chat message and return AI response with modified project."""
        try:
            # Extract chat history
            chat_history = self._extract_chat_history(project)
            
            # Get current phase
            current_phase = self._get_current_phase(project)
            
            # Create project context
            project_context = self._create_project_context(project)
            
            # Prepare input with context
            full_input = f"Project Context:\n{project_context}\n\nUser Message: {user_input}"
            
            # Get the appropriate agent
            agent = self.agents[current_phase]
            
            # Run the agent
            result = agent.invoke({
                "input": full_input,
                "chat_history": chat_history
            })
            
            # Extract AI response
            ai_response = result.get("output", "I'm sorry, I couldn't process your request.")
            
            # Create modified project (for now, return the original project)
            # In a real implementation, you would modify the project based on tool calls
            modified_project = project.copy()
            
            # Add the new message to chat history
            if "chatHistory" not in modified_project:
                modified_project["chatHistory"] = []
            
            # Add user message
            modified_project["chatHistory"].append({
                "role": "user",
                "content": user_input
            })
            
            # Add AI response
            modified_project["chatHistory"].append({
                "role": "assistant", 
                "content": ai_response
            })
            
            return ai_response, modified_project
            
        except Exception as e:
            error_message = f"I encountered an error while processing your request: {str(e)}"
            return error_message, project
