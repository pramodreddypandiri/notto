# Personalized Weekend Planning App - Project Brief

## Quick Overview
A voice-first weekend concierge app that turns messy notes into timely reminders and 2-3 curated weekend plans using AI + live search.

## Core Problem
People want better weekends with less effort. They express needs as fragments ("I wanna go bowling", "try Mexican food") but traditional planners don't convert these into actionable plans.

## Key Product Principles

### 1. **Not a Traditional Planner**
- Users don't manually structure tasks
- Messy human input (especially voice) → automatic actions
- Flow: capture → interpret → remind → recommend → learn

### 2. **Voice-First Capture**
Users think in fragments:
- "Email Jack for update on interview on Thursday"
- "I wanna eat pizza"
- "I like eating ice cream at night"

App extracts structure automatically:
- Tasks: action + who + when
- Preferences: likes/dislikes
- Intent signals: wants and cravings

### 3. **The Magic Moment: 2-3 Complete Plans (Not 20 Options)**
Instead of search results, generate bundled plans:
- **Plan A:** Saturday 6-10pm - bowling + pizza + dessert
- **Plan B:** Sunday afternoon - seasonal activity + easy dinner

Each includes timeline, activities, and brief rationale.

## System Architecture

### Input Layer
- Voice notes (primary)
- Text quick capture
- Future: photos/screenshots, calendar sync

### Understanding Layer (AI Interpretation)
Transform raw input into:
- **Tasks:** "Email Jack for interview update" (Thursday)
- **Reminders:** Clean, actionable phrases
- **Preferences:** Cuisine, activities, time-of-day affinities
- **Constraints:** Time, budget, distance, group size

### Memory/User Model
Continuously evolving profile:
- Cuisine preferences (Mexican, pizza)
- Activities (bowling, stargazing, seasonal events)
- Time affinities (ice cream at night)
- Entertainment tastes (comedy, specific shows)

### Live Data Layer (Critical Design Choice)
**We DON'T build a static places database.** Instead:
- Use APIs when available (Google Places, Yelp, etc.)
- Live search on-demand
- Agent looks up: open hours, distance, prices, seasonal events

**Why:** New places appear constantly, data changes frequently, impossible to maintain comprehensive database.

### Plan Generator (The "Magic Moment" Engine)
Agent workflow:
1. Read user context (preferences, constraints)
2. Search nearby options
3. Rank based on learned preferences
4. Generate 2-3 bundled plans with reasoning
5. Ask minimal follow-ups only if needed

### Feedback Loop
Collect signals:
- Liked/disliked plan
- "Too far", "too expensive", "not the right vibe"
- What to prioritize next time

## User Flow Example

**During the week:**
- User: "I wanna go bowling" (voice note)
- User: "Try Mexican food" (typed)
- User: "Email Jack about interview on Thursday" (voice)

**App processes:**
- Stores preferences: bowling, Mexican food
- Creates reminder: "Email Jack for interview update - Thursday"

**Friday evening:**
- User: "Plan my weekend"

**Agent generates:**
- Searches bowling alleys + Mexican restaurants nearby
- Checks open hours, travel times
- Creates 2 plans:
  - Plan A: Sat 6-10pm - Bowling at Lucky Strike + Tacos at Casa Luna
  - Plan B: Sat 2-6pm - Afternoon bowling + Late Mexican lunch

**User selects Plan A, provides feedback:**
- "Loved it!" or "Too late, prefer earlier next time"

## Core Features (In Scope)

✅ Voice/text capture  
✅ Task/reminder extraction  
✅ Preference learning (activities, food, timing)  
✅ Weekend plan bundles (2-3 options)  
✅ Agent-based place discovery  
✅ Feedback learning loop  

## Explicitly NOT Core

❌ Market research workstream  
❌ Building comprehensive places database  
❌ Positioning as "journaling app"  

## Tech Decisions to Make

### Memory Structure
- Lightweight tags + embeddings?
- Fully structured preference model?
- Hybrid approach? (likely best)

### Follow-up Questions
Minimize friction. Only ask when it materially improves plan quality:
- Distance tolerance
- Budget range
- Time window

### Success Metrics
User accepts a plan AND (completes 1-2 activities OR reports great match)

## Current State
This is a greenfield project. We have:
- ✅ Clear product vision
- ✅ User behavior understanding
- ✅ System architecture blueprint
- ⏳ Need to start building

## Development Guidance for Claude

When helping with this project:
1. **Prioritize voice capture and NLP interpretation** - this is the foundation
2. **Design for the agent pattern** - search on-demand, don't pre-populate databases
3. **Keep the "2-3 plans" constraint** - resist feature creep to endless options
4. **Build feedback loops early** - personalization is core differentiation
5. **Think mobile-first** - voice capture works best on mobile
6. **API-first for places data** - Google Places API, Yelp Fusion, etc.

## Key Differentiators to Preserve

1. **Voice-first**, not text-first
2. **Curated plans**, not search results
3. **Learning system**, not static preferences
4. **Live data**, not stale database
5. **Weekend focus**, not general productivity

---

**One-sentence summary:**  
A personalized weekend concierge that turns messy voice notes and scattered cravings into timely reminders and 2-3 ready-to-go weekend plans using a live-search agent and a learning feedback loop.
