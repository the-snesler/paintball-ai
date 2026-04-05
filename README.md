# Paintball

AI image generation gallery with multi-model support. Runs mostly in the user's browser, proxies requests to Replicate via a Cloudflare Worker.

<img width="1699" height="1062" alt="image" src="https://github.com/user-attachments/assets/67b51663-bdb3-4997-8194-e7a33cfdf85e" />

## Features

- Multiple concurrent generations from different models
- Full-resolution originals with lightweight gallery thumbnails (max 400px wide)
- Reference image support for editing workflows
- Custom aspect ratios
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
