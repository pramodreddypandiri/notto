# Getting Started with Claude in VS Code

## Quick Setup Checklist

When you open a new chat with Claude in VS Code, share these two files:

1. **PROJECT_BRIEF.md** - Complete project context
2. **CURRENT_TASK.md** - What you're working on right now (create this file)

## How to Brief Claude Effectively

### ✅ Good First Message
```
I'm building a personalized weekend planning app. I've attached the 
PROJECT_BRIEF.md with the full context.

Right now I need help with: [specific task]
- Current tech stack: [list]
- What I've already built: [brief summary]
- What I'm stuck on: [specific question]
```

### ❌ Avoid
```
"Help me build an app"
```
(Too vague - Claude needs specific context)

## Recommended First Tasks

### Phase 1: Core Capture System
1. **Voice-to-text setup**
   - Research: Web Speech API vs native mobile APIs
   - Prototype: Simple voice recorder → text output
   
2. **Smart interpretation prototype**
   - Input: Raw text (e.g., "Email Jack about interview Thursday")
   - Output: Structured JSON (action, entity, time, reminder)
   - Tools: Claude API, OpenAI, or local LLM

3. **Basic storage**
   - Store: Raw notes, extracted tasks, preferences
   - Database: Start simple (SQLite, Firebase, or Supabase)

### Phase 2: Place Discovery Agent
1. **API integration**
   - Google Places API or Yelp Fusion
   - Test: Search "bowling alleys near me"
   - Extract: name, hours, location, rating

2. **Basic plan generation**
   - Input: User preferences + location
   - Output: 2-3 bundled plans
   - Use: Claude API for reasoning

### Phase 3: Feedback & Learning
1. **Feedback collection**
   - Like/dislike plans
   - Specific feedback (too far, wrong vibe, etc.)

2. **Simple personalization**
   - Weight preferences by feedback
   - Adjust distance/price thresholds

## Sample Questions for Claude

### Architecture & Design
- "What's the best way to structure the user preference model?"
- "Should I use embeddings for semantic preference matching?"
- "How should I design the agent workflow for plan generation?"

### Implementation
- "Help me set up voice recording in React Native"
- "Write a prompt for extracting structured data from messy notes"
- "Design a database schema for tasks, preferences, and feedback"

### Integration
- "How do I call the Google Places API to find bowling alleys?"
- "Create a function to rank places based on user preferences"
- "Build a feedback loop to update preference weights"

## Tech Stack Suggestions

### Frontend (Pick One)
- **React Native** - Cross-platform mobile (recommended for voice)
- **Flutter** - Alternative cross-platform
- **PWA** - Web-based with mobile capabilities

### Backend
- **Node.js + Express** - Simple API server
- **Python + FastAPI** - If using ML/embeddings
- **Supabase** - Backend-as-a-service (easier setup)

### AI/NLP
- **Claude API** - Best for nuanced interpretation
- **OpenAI GPT-4** - Alternative
- **Local models** - For privacy/cost concerns

### Database
- **PostgreSQL** - Robust, good for structured + vector data
- **Firebase** - Quick setup, real-time sync
- **Supabase** - PostgreSQL + real-time + auth

### Places Data
- **Google Places API** - Comprehensive, reliable
- **Yelp Fusion API** - Good for hours/reviews
- **Foursquare** - Alternative option

## Tips for Working with Claude in VS Code

1. **Be specific about context**
   - Share relevant files
   - Mention what you've already tried
   - Specify your tech stack

2. **Ask for complete code when needed**
   - "Write the full component with all imports"
   - "Include error handling"
   - "Add TypeScript types"

3. **Iterate on architecture early**
   - Get feedback on system design before coding
   - Ask about trade-offs
   - Request alternative approaches

4. **Use Claude for code review**
   - Share your implementation
   - Ask about best practices
   - Request optimization suggestions

## Example Workflow

### Starting a New Feature

1. **Brief Claude:**
   ```
   Context: Building the voice capture module for the weekend planning app 
   (see PROJECT_BRIEF.md).
   
   Tech stack: React Native, Expo
   
   Goal: Let users record voice notes that get transcribed to text.
   
   Questions:
   1. Should I use Expo AV or expo-speech-to-text?
   2. How do I handle permissions?
   3. What's the best UX pattern for voice recording?
   ```

2. **Get Architecture Guidance:**
   Claude provides options, trade-offs, and recommendations.

3. **Request Implementation:**
   ```
   Let's go with expo-speech-to-text. Can you write:
   1. VoiceRecorder component with UI
   2. Permission handling
   3. State management for transcript
   ```

4. **Iterate:**
   ```
   This works but transcription is slow. How can I:
   1. Show real-time feedback while recording?
   2. Handle interruptions (phone calls, etc.)?
   3. Add a retry mechanism?
   ```

## Common Gotchas

1. **Claude doesn't have your project files**
   - Always share relevant code or describe your structure
   - Use `@workspace` to reference files if available

2. **Tech stack changes matter**
   - If you switch from React to React Native, tell Claude
   - Specify versions when they matter

3. **Don't assume Claude knows your progress**
   - Each conversation is fresh
   - Briefly summarize what's already built

## Next Steps

1. Create `CURRENT_TASK.md` to track your immediate goals
2. Choose your tech stack
3. Start with the simplest possible version of voice capture
4. Build the interpretation layer next
5. Add place discovery only after core capture works

---

**Remember:** Start small, validate the core concept (voice → tasks), then expand to plan generation.
