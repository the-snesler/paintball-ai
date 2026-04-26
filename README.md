# Paintball

AI image generation gallery with multi-model support. Runs mostly in the user's browser, proxies requests to Replicate via a Cloudflare Worker.

<img width="1699" height="1062" alt="image" src="https://github.com/user-attachments/assets/67b51663-bdb3-4997-8194-e7a33cfdf85e" />

## Features

- Multiple concurrent generations from different models, with support for many providers (Replicate, OpenAI, and Google)
- Editor view: iterate on a single image, with comparison between original and new variations & edit history
- Semantic search: easily find past images in the gallery, with embeddings done locally in the background
- Text model support: automatically improve prompts, generate prompts from images, and create variations on prompts
- Upscaling model support: generate high-resolution images from low-resolution inputs
- Add literally any image model from Replicate, using text models to adapt to different input and output formats
- Reference image support for editing workflows
- Custom aspect ratios and resolutions
- Masonry gallery layout with grid/list views
- Drag & drop images from gallery to reference inputs
- Multi-select gallery actions: bulk delete, bulk download, and bulk attach to prompt references

## Stack

- React Router 7
- Cloudflare Workers
- Replicate API
- Tailwind CSS
- Zustand

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Deploy

```bash
pnpm build
wrangler deploy
```
