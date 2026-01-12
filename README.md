# Paintball

AI image generation gallery with multi-model support. Runs mostly in the user's browser, proxies requests to Replicate via a Cloudflare Worker.

<img width="1699" height="1062" alt="image" src="https://github.com/user-attachments/assets/9470a4c1-b19a-4b8a-98b2-8e96366639d7" />

## Features

- Multiple concurrent generations from different models
- Reference image support for editing workflows
- Custom aspect ratios
- Masonry gallery layout with grid/list views
- Drag & drop images from gallery to reference inputs

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
