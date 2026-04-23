# AGENTS.md - Claude Code Guide

## Project Overview

**Paintball** is a single-page AI image generation webapp with a BYOK (Bring Your Own Key) model. Users provide their own API keys, generate images with various AI models, and all data stays in their browser.

### Core Principles
- **Client-side only**: No server-side API routes. Direct browser-to-API calls.
- **BYOK**: API keys stored in localStorage, images in IndexedDB. Nothing leaves the browser.
- **Multi-model**: Users can select multiple models and generate images in parallel.

## Tech Stack

- **Package Manager**: pnpm (use `pnpm install`, not npm)
- **Framework**: React Router 7 (SPA mode, `ssr: false`)
- **Styling**: Tailwind CSS 4
- **State**: Zustand (with localStorage persistence for settings)
- **Storage**: IndexedDB for images and references, localStorage for API keys/settings
- **Icons**: Lucide React
- **AI**: Google GenAI SDK (`@google/genai`), Replicate SDK

## Commit Message Style

- "feat:", "fix:", "docs:", "refactor:", "style:", "perf:", "test:", "chore:" prefixes
- include relevant issue number in commit body for tracking (e.g., "Closes #123")

## Architecture

```
app/
├── routes/
│   ├── home.tsx              # Layout: Sidebar + Lightbox + Notifications
│   ├── gallery.tsx           # Index route: gallery grid
│   ├── settings.tsx          # Settings page
│   └── editor.tsx            # Image editor page (?imageId param)
├── components/
│   ├── sidebar/              # Left panel: prompt, models, settings
│   ├── gallery/              # Main area: masonry/timeline grid
│   ├── lightbox/             # Full-screen image viewer
│   ├── settings/             # API key management, model toggles
│   ├── editor/               # Iterative image editor
│   └── ui/                   # Shared primitives (Switch, Tooltip)
├── stores/
│   ├── settingsStore.ts      # API keys + model list (persisted)
│   ├── galleryStore.ts       # Gallery items + current generation inputs
│   └── editorStore.ts        # Editor session state (not persisted)
├── hooks/
│   ├── useImageGeneration.ts # Gallery generation logic
│   └── useEditorGeneration.ts# Editor generation logic
├── lib/
│   ├── generation.ts         # Core API calls (Google/Replicate)
│   ├── models.ts             # Capability helpers & ASPECT_RATIOS
│   ├── builtInModels.ts      # Pre-configured model definitions
│   ├── db.ts                 # IndexedDB operations
│   ├── promptVariations.ts   # {{...}} variation parsing & generation
│   ├── textModel.ts          # LLM calls for variations/analysis
│   ├── prompts.ts            # System prompt templates
│   ├── imageProcessing.ts    # Thumbnail generation, dimension reading
│   ├── generationSignature.ts# Deduplication hash
│   ├── retry.ts              # Retry with exponential backoff
│   ├── exportImport.ts       # ZIP-based gallery export/import
│   ├── replicateSchema.ts    # Replicate model schema introspection
│   ├── galleryGrouping.ts    # Date-based grouping utility
│   ├── util.ts               # blobToBase64, sleep
│   └── logging.ts            # Debug logger
└── types/
    └── index.ts              # TypeScript types
```

## State Management

### Three Zustand Stores

1. **`settingsStore`** - Persisted to localStorage
   - `apiKeys`: `{ google, replicate }` — provider API keys
   - `models: StoredModel[]` — built-in + user-added Replicate models (ordered)
   - `textModel` — provider/modelId for the LLM used for variations
   - `desktopNotificationsEnabled`, `notificationPromptDismissed`
   - `requestedOutputCount` — lifetime image request counter

2. **`galleryStore`** - Not persisted
   - `items: GalleryItem[]` — unified array of pending/generating/completed/failed items
   - **Current input state** (for UI controls):
     - `currentPrompt`, `currentModelSelections`, `currentAspectRatio`, `currentResolution`
     - `currentReferenceImages: ReferenceImage[]`
     - `variationsEnabled`, `avoidPastVariations`
   - **Generation tracking**: `isGenerating`, `activeGenerationCount`, `activeGenerationSignatures`
   - **View state**: `viewMode`, `isLightboxOpen`, `lightboxTarget`, `selectedItemIds`

3. **`editorStore`** - Not persisted
   - `sourceBlob`, `sourceUrl`, `sourcePrompt`, `sourceGalleryItemId`
   - `turns: EditorTurn[]` — conversation history
   - `selectedItemId` — active canvas item (reference for next edit)
   - `instruction` — current edit input
   - `isGenerating`

### Important Zustand Pattern

**Don't subscribe to store functions, subscribe to state:**

```tsx
// ❌ BAD - function reference never changes, no re-renders
const getSelectedModelIds = useGalleryStore((s) => s.getSelectedModelIds);
const selected = getSelectedModelIds();

// ✅ GOOD - subscribes to actual state, re-renders on change
const modelSelections = useGalleryStore((s) => s.currentModelSelections);
const selected = Object.entries(modelSelections)
  .filter(([, count]) => count > 0)
  .map(([id]) => id);
```

## Model System

Model definitions live in `lib/builtInModels.ts`. `lib/models.ts` contains only capability helpers.

```typescript
interface StoredModel {
  id: string;
  name: string;
  provider: 'google' | 'replicate';
  enabled: boolean;
  isCustom?: boolean;          // User-added via Settings
  schemaFetched?: boolean;     // Replicate schema has been introspected
  schemaMapping?: SchemaMapping; // Translated parameter names for non-standard models
  capabilities: {
    supportsAspectRatios: boolean;
    supportsResolution: boolean;
    resolutions?: Resolution[];
    supportsReferenceImages: boolean;
    maxReferenceImages: number;
  };
  icon?: string;
}
```

### Capability-Based UI

- **Aspect Ratio Picker**: Enabled if ANY selected model has `supportsAspectRatios: true`
- **Resolution Picker**: Shown if ANY selected model has `supportsResolution: true`
- **Reference Images**: Strict intersection of `maxReferenceImages` across selected models

Key helpers in `lib/models.ts`:
- `anyModelSupportsAspectRatio(models, selectedIds)` — Should picker show?
- `anyModelSupportsResolution(models, selectedIds)` — Show resolution picker?
- `getStrictReferenceImageLimit(models, selectedIds)` — Max reference images
- `canAttachReferenceCount(models, selectedIds, count)` — Validate attachment

### Custom Models

Users can add arbitrary Replicate models via Settings. The app:
1. Calls `replicateSchema.ts` to introspect the model's API schema
2. Calls the text model with `SCHEMA_MAPPING_SYSTEM` prompt to generate a `SchemaMapping`
3. Stores the mapping in `settingsStore` so non-standard parameter names are translated correctly

## Image Generation Flow

1. User clicks Generate
2. `useImageGeneration.generate()` runs:
   - Parses `{{...}}` variation sections from prompt
   - If `variationsEnabled`: calls text model to generate N alternatives per section, optionally deduplicating against past generations
   - Creates one `GalleryItem` per model × count with `status: 'pending'`
   - Adds all pending items to `galleryStore.items` immediately (loading cards appear)
   - Persists any reference images to IndexedDB
   - Calls `executeGeneration()` in parallel via `Promise.allSettled`
3. Each item transitions through states in place:
   - `status: 'waiting'` — rate-limit backoff, shows countdown
   - `status: 'generating'` — API call in flight
   - `status: 'completed'` — blob saved, thumbnail generated, stored in IndexedDB
   - `status: 'failed'` — error shown, can retry

### State Transitions

```
pending → generating → completed (saved to IndexedDB)
        ↘ waiting  ↗
                   ↘ failed (ephemeral — dismissed or cleared on reload)
```

Key insight: **Loading cards and image cards are the same item** — just at different stages. When an item completes, it updates in place.

### Retry & Rate Limiting

`lib/retry.ts` wraps `executeGeneration()` with exponential backoff. A `RateLimitError` (HTTP 429) causes the item to enter `status: 'waiting'` with a visible countdown, then automatically retries.

## Image Editor

The editor is at `/editor` (nested inside the home layout so the sidebar stays visible).

### Flow

1. Entry: user clicks "Edit" in lightbox (passes `?imageId`) or drops a file on the editor page
2. Source image is saved to IndexedDB as a reference image (for retry resilience)
3. User writes an instruction in `EditorInputBar` and clicks Send
4. `useEditorGeneration.generateEdit()`:
   - Creates pending items synchronously and calls `onItemsCreated` **before any await**
   - This ensures the turn is registered in `editorStore` before results arrive
   - Saves completed images to gallery (same IndexedDB as main gallery)
5. Each result appears in the turn's image grid in `TurnList`
6. Clicking an image in a turn selects it (purple ring) — it becomes the reference for the next edit
7. The sidebar's model/aspect ratio/resolution controls apply to editor generation too

### Key Files

- `routes/editor.tsx` — loads image by `?imageId`, sets editor source
- `components/editor/EditorView.tsx` — layout: header + TurnList/DropZone + EditorInputBar
- `components/editor/TurnList.tsx` — scrollable conversation history
- `components/editor/Turn.tsx` — one turn: instruction + source thumb + results grid
- `components/editor/EditorInputBar.tsx` — input, paste-to-set-source, analyze (reverse prompt)
- `components/editor/DropZone.tsx` — empty state when no source loaded
- `stores/editorStore.ts` — session state
- `hooks/useEditorGeneration.ts` — generation hook

## Prompt Variations

Users write `{{description: example1, example2}}` in prompts. When Variations is enabled:

1. `promptVariations.ts` parses the `{{...}}` sections
2. `textModel.ts` is called with `VARIATION_SYSTEM` prompt to generate N alternatives per section
3. If `avoidPastVariations` is on, past variation values are collected and sent to the model to avoid
4. `buildVariedPrompts()` assembles N complete prompts from the alternatives
5. The original `{{...}}` template is stored as `basePrompt`; applied values go in `variationReplacements`

## Text Model

A secondary LLM is used for:
- Generating prompt variations (`VARIATION_SYSTEM`)
- Reverse-prompting images back to text (`REVERSE_PROMPT_SYSTEM`)
- Improving user prompts (`IMPROVE_PROMPT_SYSTEM`)
- Mapping Replicate model schemas (`SCHEMA_MAPPING_SYSTEM`)

Configured in Settings (`settingsStore.textModel`). Supports Google Gemini (with `ThinkingLevel.LOW`) and Replicate text models.

## CSS Patterns

### Masonry Grid

Uses `masonry-pf` library with CSS column fallback:

```css
.masonry-grid {
  columns: 4 280px;
  column-gap: 16px;
}
.masonry-grid > * {
  break-inside: avoid;
  margin-bottom: 16px;
}
```

### Dark Theme

App is dark-mode only. Key colors:
- `zinc-950` — Background
- `zinc-900` — Elevated surfaces (sidebar, cards)
- `zinc-800` — Interactive elements
- `purple-500` — Accent/selected states
- `red-400` — Errors

## Common Tasks

### Adding a Built-In Model

1. Add to `BUILT_IN_MODELS` array in `lib/builtInModels.ts`
2. Set `provider`, `capabilities`, and default `enabled` state
3. If new provider: add to `ApiKeys` type in `types/index.ts`, `settingsStore`, and implement in `lib/generation.ts`

### Adding a New Generation Setting

1. Add to `GalleryState` in `galleryStore.ts` (e.g., `currentStylePreset`)
2. Add a setter action
3. Add to `GalleryItem` + `StoredImageRecord` in `types/index.ts`
4. Create UI component in `components/sidebar/`
5. Pass to generation in `useImageGeneration.ts` and `lib/generation.ts`
6. Include in `saveImage()` call in `lib/db.ts`

### Adding a Prompt System

Add a new `const X_SYSTEM = ...` to `lib/prompts.ts` and call it via `callTextModel()` from `lib/textModel.ts`.

## Gotchas

1. **Object URLs**: Created with `URL.createObjectURL()`, must be revoked to prevent memory leaks.
   - Created in: `galleryStore.loadImages()`, `useImageGeneration` on completion, `editorStore.setSource()`
   - Cleaned up in: `deleteItem()`, `dismissItem()`, `editorStore.reset()`

2. **IndexedDB async**: All DB operations are async. Gallery loads on mount via `useEffect` in `home.tsx`. IndexedDB version is currently **2** (v1→v2 migration: single blob → `originalBlob` + `thumbnailBlob`).

3. **SPA mode**: `react-router.config.ts` has `ssr: false`. No server routes, no loaders/actions.

4. **Unified state**: `GalleryItem` is used for pending, generating, waiting, completed, and failed states. Always check `item.status === 'completed'` before accessing output fields (`originalBlob`, `originalUrl`, `thumbnailUrl`, `width`, `height`, `createdAt`). Input fields (`prompt`, `aspectRatio`, etc.) are always present on all statuses.

5. **Editor generation callback order**: `useEditorGeneration` calls `onItemsCreated(itemIds)` synchronously before any `await`. This is intentional — callers must register the turn in `editorStore` before the async generation completes.

6. **Replicate schema mapping**: Non-standard Replicate models use `schemaMapping` to translate parameter names (e.g., `imageInputKey`, `resolution` map). Always pass through `schemaMapping` when calling `generateWithReplicate`.

7. **Reference image limits**: Use the intersection of `maxReferenceImages` across all selected models. `getStrictReferenceImageLimit()` returns this value; use `canAttachReferenceCount()` to validate before attaching.

8. **`builtInModels` vs `settingsStore.models`**: `settingsStore` stores the user's model list (built-ins merged with user overrides). Always read models from the store, not directly from `builtInModels.ts`. Use `mergeWithBuiltInModels()` for migrations.
