# AGENTS.md - Claude Code Guide

## Project Overview

**Paintball** is a single-page AI image generation webapp with a BYOK (Bring Your Own Key) model. Users provide their own API keys, generate images with various AI models, and all data stays in their browser.

### Core Principles
- **Client-side only**: No server-side API routes. Direct browser-to-API calls.
- **BYOK**: API keys stored in localStorage, images in IndexedDB. Nothing leaves the browser.
- **Multi-model**: Users can select multiple models and generate images in parallel.

## Tech Stack

- **Framework**: React Router 7 (SPA mode, `ssr: false`)
- **Styling**: Tailwind CSS 4
- **State**: Zustand (with localStorage persistence for settings)
- **Storage**: IndexedDB for images, localStorage for API keys
- **Icons**: Lucide React
- **AI**: Vercel AI SDK (`@ai-sdk/google` for Gemini)

## Architecture

```
app/
├── routes/
│   └── home.tsx              # Main page, composes Sidebar + Gallery
├── components/
│   ├── sidebar/              # Left panel: prompt, models, settings
│   ├── gallery/              # Main area: masonry grid of images
│   ├── lightbox/             # Full-screen image viewer
│   └── settings/             # API key management modal
├── stores/                   # Zustand stores
│   ├── settingsStore.ts      # API keys (persisted)
│   ├── generationStore.ts    # Generation state (prompt, models, pending)
│   └── galleryStore.ts       # Images, view mode, lightbox state
├── hooks/
│   └── useImageGeneration.ts # Core generation logic
├── lib/
│   ├── db.ts                 # IndexedDB operations
│   └── models.ts             # Model definitions & capability helpers
└── types/
    └── index.ts              # TypeScript types
```

## State Management

### Two Zustand Stores

1. **`settingsStore`** - Persisted to localStorage
   - `apiKeys`: Record of provider → API key
   - `settingsModalOpen`: Modal visibility

2. **`galleryStore`** - Unified state for inputs and outputs
   - **Gallery items**: `items: GalleryItem[]` - Unified array containing all items
     - Items with `status: 'pending' | 'generating'` - Loading cards
     - Items with `status: 'failed'` - Error cards (dismissible)
     - Items with `status: 'completed'` - Rendered as image cards
   - **Current input settings** (for UI controls):
     - `currentPrompt`: Prompt text being typed
     - `currentModelSelections`: `Record<modelId, count>`
     - `currentAspectRatio`, `currentResolution`: Generation settings
     - `currentReferenceImages`: Uploaded images for img2img
     - `isGenerating`: Loading state
   - **View state**:
     - `viewMode`: 'grid' | 'timeline'
     - `selectedImageId`, `isLightboxOpen`: Lightbox state

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

Models are defined in `lib/models.ts` with capabilities:

```typescript
interface ModelDefinition {
  id: string;                    // API model ID
  name: string;                  // Display name
  provider: 'google' | 'openai'; // Which API key to use
  capabilities: {
    aspectRatios: AspectRatio[]; // Empty = doesn't support aspect selection
    supportsResolution: boolean; // 1K/2K/4K options
    supportsReferenceImages: boolean;
    maxReferenceImages: number;
  };
}
```

### Capability-Based UI

- **Aspect Ratio Picker**: Enabled if ANY selected model has `aspectRatios.length > 0`
- **Resolution Picker**: Shown if ANY selected model has `supportsResolution: true`
- When multiple models selected, show intersection of their capabilities

Key helpers in `lib/models.ts`:
- `anyModelSupportsAspectRatio(ids)` - Should picker be enabled?
- `getCommonAspectRatios(ids)` - Which ratios are available?
- `anyModelSupportsResolution(ids)` - Show resolution picker?

## Image Generation Flow

1. User clicks Generate
2. `useImageGeneration` creates pending `GalleryItem` objects with `status: 'pending'`
3. Pending items added to `galleryStore.items` (shows loading cards immediately)
4. Parallel API calls via `Promise.allSettled`
5. Each item transitions through states in place:
   - `status: 'generating'` - API call in progress
   - `status: 'completed'` - Success, saved to IndexedDB, shows image
   - `status: 'failed'` - Error, shows error message with dismiss button
6. **No separate cleanup needed** - items naturally transition from pending → completed

### State Transitions

Each `GalleryItem` flows through these states:
```
pending → generating → completed (saved to IndexedDB)
                    ↘ failed (ephemeral, dismissed or cleared on reload)
```

Key insight: **Loading cards and image cards are the same item** - just at different stages. When an item completes, it updates in place, instantly replacing its loading card.

### Error Handling

Failed generations stay visible (not saved to IndexedDB) until:
- User clicks X to dismiss via `dismissItem(id)`
- Page is reloaded (ephemeral state)

## CSS Patterns

### Masonry Grid

Uses CSS `columns` for universal browser support:

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

Progressive enhancement for native masonry when available.

### Dark Theme

App is dark-mode only. Key colors:
- `zinc-950` - Background
- `zinc-900` - Elevated surfaces (sidebar, cards)
- `zinc-800` - Interactive elements
- `purple-500` - Accent/selected states
- `red-400` - Errors

## Common Tasks

### Adding a New Model

1. Add to `MODELS` array in `lib/models.ts`
2. Set appropriate `capabilities`
3. If new provider, add to `ApiKeys` type and `settingsStore`
4. Implement provider in `useImageGeneration.ts` `executeGeneration()`

### Adding a New Generation Setting

1. Add to `GalleryState` interface in `galleryStore.ts` (e.g., `currentStylePreset`)
2. Add setter action (e.g., `setStylePreset`)
3. Add to `GalleryItem` type in `types/index.ts` (so it's saved with outputs)
4. Create UI component in `components/sidebar/`
5. Pass to generation task and update in `useImageGeneration.ts`
6. Update `saveImage` call to include new setting

## Gotchas

1. **Object URLs**: Created with `URL.createObjectURL()`, must be revoked to prevent memory leaks. Creation happens in:
   - `galleryStore.loadImages()` for persisted images
   - `useImageGeneration` when generation completes
   - Cleanup happens on `deleteItem()` or `dismissItem()`

2. **IndexedDB async**: All DB operations are async. Gallery loads on mount via `useEffect` in `home.tsx`.

3. **SPA mode**: `react-router.config.ts` has `ssr: false`. No server routes, no loaders/actions.

4. **Gemini API format**: Uses `generateContent` endpoint with `responseModalities: ["image", "text"]`. Response images are in `candidate.content.parts[].inlineData`.

5. **Aspect ratio logic**: Models with empty `aspectRatios: []` don't support the feature. The picker should be disabled only when ALL selected models have empty arrays.

6. **Unified state**: `GalleryItem` is used for both pending and completed items. Check `item.status === 'completed'` before accessing output fields like `blob`, `url`, `width`, `height`, `createdAt`. Input fields (`prompt`, `aspectRatio`, etc.) are always present.
