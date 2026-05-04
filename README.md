# Paintball

AI image generation gallery with multi-model support. Runs mostly in the user's browser, proxies requests to Replicate via a Cloudflare Worker.

<img width="1918" height="1257" alt="image" src="https://github.com/user-attachments/assets/a27ca757-7947-4269-96cd-82ca45b20f3e" />


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

## Screenshots
<img width="1942" height="1357" alt="image" src="https://github.com/user-attachments/assets/1fe4e1b5-8d45-47cc-bc52-038f9348a563" />

<img width="1942" height="1357" alt="Screenshot 2026-05-04 at 10-22-17 Paintball - AI Image Generation" src="https://github.com/user-attachments/assets/85d6d8b4-aae6-413e-8983-36e206ab6a87" />

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
