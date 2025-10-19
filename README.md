# AI Writing Tool Moodle Plugin

This Moodle plugin integrates an AI writing assistant that guides students through structured writing workflows. Students can collaborate with the AI to develop ideas, create structured outlines, generate content, and receive targeted feedback for improvement.

## Installation & Setup

### 1. Install the Plugin
1. Compress the 'writeassistdev' the into a `.zip` file
2. In Moodle, go to **Site Administration > Plugins > Install plugins**
3. Upload the `writeassistdev.zip` file and install the plugin
4. Follow the installation prompts to complete the setup

### 2. Start the Backend API
1. Navigate to the `api/` directory in your project folder
2. Install dependencies: `pip install -r requirements.txt`
3. Set up your OpenAI API key in a `.env` file: `OPENAI_API_KEY=your_api_key_here`
4. Run the Flask backend: `python app.py`

### 3. Configure Plugin Settings
1. In Moodle, go to **Site Administration > Plugins > Activity modules > AI Writing Assistant**
2. Set the **Backend API URL** to point to your running backend (e.g., `http://<ip>:5004`)
4. Save the configuration

### 4. Create an AI Writing Assistant Activity
1. In any course, click **"Add an activity or resource"**
2. Select **"AI Writing Assistant"** from the activity list
3. Configure the activity settings:
   - **Activity name**: Give your writing assignment a title
   - **Description**: Provide instructions for the writing task
   - **Writing template**: Choose from available templates (argumentative, comparative, lab report, etc.)
4. Save and return to course
5. Students can now access the AI Writing Assistant activity and begin their writing process

## Development TODO

#### 1. Finalize AI Agent
-Make sure each phase (Plan & Organize, Write, Edit & Revise) has optimized system prompts that guide the AI's behavior appropriately
-Make sure the agent has the parts of the project JSON schema that are relevant for better context
-Fix and test the `AddIdeaTool` and `AddCommentTool` tool calls to ensure they properly modify the project JSON structure
-Make sure that the project load/save logic can dynamically handle the agent's changes to brainstorm ideas and quill editor content with HTML comment attributes

#### 3. Test Project Saving with Multiple Users (Implemented, not fully tested)
- Test project saving/loading logic with multiple test users to ensure data isolation
- Verify that each user has their own independent project per activity module per course
- Ensure project data persists correctly across sessions and doesn't interfere between users

#### 2. Improve Write Phase
-Break down the single blank quill editor into small, focused editable sections for each section in the outline created during the plan/outline phase. This will help with "Blank Page Paralysis"
-Dynamically display the outline the user created in the plan/outline phase, with isolated editors for each section. Ensure the sectioned editors update automatically if the user goes back to the plan phase and modifies the outline

#### 4. UI/UX Polish
- Fix inconsistencies in style, padding, and spacing throughout the interface
- Make sure the plugin works well across different screen sizes and devices
