import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/landing";
import { useSettingsStore } from "~/stores/settingsStore";
import IconGithub from "~icons/dinkie-icons/github";
import IconSparkles from "~icons/dinkie-icons/sparkles";
import IconBrush from "~icons/dinkie-icons/brush";
import IconEye from "~icons/dinkie-icons/eye";
import IconMagicWand from "~icons/dinkie-icons/magic-wand";
import IconArrowsMaximize from "~icons/dinkie-icons/arrows-maximize";
import IconCode from "~icons/dinkie-icons/code";
import IconPalette from "~icons/dinkie-icons/artist-palette";
import IconDotMatrix from "~icons/dinkie-icons/display-dot-matrix";
import IconWindows from "~icons/dinkie-icons/windows-alt";
import IconAccept from "~icons/dinkie-icons/accept-circle";
import IconShield from "~icons/dinkie-icons/shield";
import IconShuffle from "~icons/dinkie-icons/shuffle-arrows";
import IconArrow from "~icons/dinkie-icons/right-arrow-circled";
import IconDroplet from "~icons/dinkie-icons/droplet";
import { InkDropGrid } from "~/components/landing/InkDropGrid";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Paintball — One frontend for every AI image model" },
    {
      name: "description",
      content:
        "Paintball is a bring-your-own-key image generation app. Run OpenAI, Google, Replicate, and any custom image model side-by-side in your browser. Compare results, iterate in an editor, and keep your keys local.",
    },
    {
      name: "keywords",
      content:
        "AI image generator, bring your own key, BYOK, GPT Image, Gemini, Replicate, FLUX, Imagen, image model comparison, AI gallery",
    },
    { property: "og:title", content: "Paintball — One frontend for every AI image model" },
    {
      property: "og:description",
      content:
        "Run every modern image model from one app, with your own API keys. Compare. Iterate. Keep keys local.",
    },
    { property: "og:type", content: "website" },
    { name: "theme-color", content: "#07070a" },
  ];
}

function ProviderChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="border-c-border bg-surface-raised text-text-tertiary inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-[13px]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ModelTile({ color, name, vendor }: { color: string; name: string; vendor: string }) {
  return (
    <div className="border-c-border text-text-primary flex items-center gap-2.5 rounded-[10px] border bg-[#0c0c11] px-4 py-3.5 font-mono text-[13px]">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
      <span className="truncate">{name}</span>
      <span className="text-text-muted ml-auto text-[10px] tracking-[0.08em] uppercase">
        {vendor}
      </span>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex min-h-45 flex-col gap-2.5 bg-[#0c0c11] px-6 py-7">
      <span className="mb-1.5 grid h-9 w-9 place-items-center rounded-[9px] border border-purple-500/25 bg-purple-500/10 text-purple-400">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <h3 className="text-text-primary text-base font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="text-text-tertiary text-sm leading-[1.55]">{children}</p>
    </article>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const isReturningUser = useSettingsStore((s) => s.requestedOutputCount > 0);

  useEffect(() => {
    if (isReturningUser) {
      navigate("/app", { replace: true });
    }
  }, [isReturningUser, navigate]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
    };
    html.style.overflow = "visible";
    html.style.height = "auto";
    body.style.overflow = "visible";
    body.style.height = "auto";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
    };
  }, []);

  if (isReturningUser) return null;

  return (
    <div className="min-h-screen bg-[#07070a] text-[#f4f4f7]">
      <InkDropGrid className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-60" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-1 h-150"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(168, 85, 247, 0.18), transparent 60%)",
        }}
        aria-hidden
      />

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/4 bg-[#07070a]/65 backdrop-blur-xl">
        <div className="mx-auto flex max-w-300 items-center gap-7 px-7 py-4">
          <Link to="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
            <span
              className="relative grid h-7 w-7 place-items-center rounded-lg"
              style={{
                background: "linear-gradient(140deg, #a855f7 0%, #6d28d9 100%)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.08) inset, 0 6px 20px rgba(168,85,247,0.45)",
              }}
              aria-hidden
            >
              <IconDroplet className="h-3.5 w-3.5 text-white" />
            </span>
            <span>Paintball</span>
          </Link>
          <nav
            className="text-text-tertiary ml-2 hidden gap-6 text-sm md:flex"
            aria-label="Primary"
          >
            <a href="#features" className="hover:text-text-primary transition-colors">
              Features
            </a>
            <a href="#models" className="hover:text-text-primary transition-colors">
              Models
            </a>
            <a href="#how" className="hover:text-text-primary transition-colors">
              How it works
            </a>
            <a href="#screenshots" className="hover:text-text-primary transition-colors">
              Screenshots
            </a>
          </nav>
          <div className="flex-1" />
          <a
            href="https://github.com/the-snesler/paintball-ai"
            className="border-c-border bg-surface-raised hover:bg-surface-overlay hidden items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors sm:inline-flex"
            aria-label="View source on GitHub"
          >
            <IconGithub className="h-3.5 w-3.5" />
            GitHub
          </a>
          <Link
            to="/app"
            className="inline-flex items-center gap-2 rounded-lg border border-white bg-white px-3.5 py-2 text-sm font-medium text-[#0a0a10] transition-colors hover:bg-[#ececf2]"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-300 px-7 pt-20 pb-16">
        <div className="relative z-10 text-center">
          <h1
            className="mx-auto mb-4 max-w-225 pb-2 text-[clamp(44px,7vw,88px)] leading-[0.98] font-semibold tracking-[-0.035em]"
            style={{
              background: "linear-gradient(180deg, #fff 0%, #b8b8c4 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            One frontend.
            <br />
            <em
              className="not-italic"
              style={{
                background: "linear-gradient(180deg, #d8b4fe 0%, #a855f7 70%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Every
            </em>{" "}
            image model.
          </h1>
          <p className="text-text-tertiary mx-auto mb-9 max-w-170 text-[clamp(16px,1.4vw,19px)] leading-[1.55]">
            Paintball is a fast, local app for generating with every modern image model: OpenAI,
            Google, Replicate, or any custom checkpoint you can name. Compare side-by-side, iterate
            in an editor, search your gallery semantically. Your keys never leave your browser.
          </p>
          <div className="inline-flex flex-wrap justify-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2.5 rounded-[10px] bg-linear-to-b from-white to-[#e6e6ee] px-5.5 py-3 text-[15px] font-medium text-[#0a0a10] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-10px_rgba(255,255,255,0.25)] transition hover:-translate-y-px"
            >
              Open Paintball
              <IconArrow className="h-3.5 w-3.5" />
            </Link>
            <a
              href="https://github.com/the-snesler/paintball-ai"
              className="border-c-border inline-flex items-center gap-2.5 rounded-[10px] border bg-white/4 px-5.5 py-3 text-[15px] font-medium text-[#f4f4f7] transition hover:-translate-y-px hover:bg-white/8"
            >
              <IconGithub className="h-3.5 w-3.5" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Providers */}
      <div className="relative z-10 mx-auto max-w-275 px-7">
        <div className="text-text-muted mb-4.5 text-center font-mono text-[11px] tracking-[0.18em] uppercase">
          Plays nicely with
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <ProviderChip color="#10a37f" label="OpenAI" />
          <ProviderChip color="#4285f4" label="Google Gemini" />
          <ProviderChip color="#ff4f00" label="Replicate" />
          <ProviderChip color="#000" label="FLUX" />
          <ProviderChip color="#ff2d87" label="SDXL" />
          <ProviderChip color="#ffd23f" label="Ideogram" />
          <ProviderChip color="#7c5bff" label="Imagen 3" />
          <ProviderChip color="#2af0ff" label="+ any Replicate model" />
        </div>
      </div>

      {/* Screenshots */}
      <section id="screenshots" className="mx-auto max-w-300 px-7 py-24">
        <span className="text-accent-muted mb-4 inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase before:h-px before:w-3.5 before:bg-purple-500 before:content-['']">
          The app
        </span>
        <h2 className="mb-4 max-w-180 text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">
          A gallery, an editor, and a prompt bar walk into your browser.
        </h2>
        <p className="text-text-tertiary mb-12 max-w-150 text-[17px] leading-[1.55]">
          Generate in parallel from any model, drop reference images, and iterate from a single
          prompt. Everything is one keystroke away.
        </p>
        <div className="border-c-border relative overflow-hidden rounded-[14px] border bg-[#0c0c11] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
          <div className="border-c-border relative h-7 border-b bg-linear-to-b from-[#16161e] to-[#101017]">
            <div className="absolute top-2.5 left-3.5 flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2a2a38]" />
              <span className="h-2 w-2 rounded-full bg-[#2a2a38]" />
              <span className="h-2 w-2 rounded-full bg-[#2a2a38]" />
            </div>
          </div>
          <img
            src="/screenshot-gallery.png"
            alt="Paintball gallery view: prompt sidebar on the left with model selector, aspect ratio, and resolution controls; masonry gallery of generated images on the right tagged by model."
            className="block w-full"
          />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-300 px-7 py-24">
        <span className="text-accent-muted mb-4 inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase before:h-px before:w-3.5 before:bg-purple-500 before:content-['']">
          Features
        </span>
        <h2 className="mb-4 max-w-180 text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">
          Built for people who actually generate.
        </h2>
        <p className="text-text-tertiary mb-12 max-w-150 text-[17px] leading-[1.55]">
          Twelve practical things that compound when you use them together.
        </p>
        <div className="border-c-border grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border bg-[#1f1f2b] sm:grid-cols-2 lg:grid-cols-3">
          <Feature icon={IconShuffle} title="Concurrent generations">
            Fire one prompt at every model you care about, all at once. Watch them race in.
          </Feature>
          <Feature icon={IconBrush} title="Editor view">
            Iterate on a single image with side-by-side comparison and a full edit history you can
            rewind.
          </Feature>
          <Feature icon={IconEye} title="Semantic search">
            Search your gallery by meaning, not filenames. Embeddings run locally in the background
            — no upload.
          </Feature>
          <Feature icon={IconMagicWand} title="Prompt rewriting">
            Plug in a text model and one click turns a sketch of an idea into something a diffusion
            model can actually read.
          </Feature>
          <Feature icon={IconArrowsMaximize} title="Upscalers, built in">
            Promote a thumbnail-grade output to a 4K asset without leaving the gallery. Same models
            you'd reach for anyway.
          </Feature>
          <Feature icon={IconCode} title="Any Replicate model">
            Paste a Replicate URL. A text model adapts to whatever input and output schema the model
            exposes. Done.
          </Feature>
          <Feature icon={IconPalette} title="Reference images">
            Drop any image as a reference for editing or style transfer. Drag from the gallery,
            paste from clipboard.
          </Feature>
          <Feature icon={IconDotMatrix} title="Custom ratios & res">
            1:1, 16:9, 9:16, 4:3, 21:9 — or punch in arbitrary dimensions and resolution tiers up to
            4K.
          </Feature>
          <Feature icon={IconWindows} title="Masonry gallery">
            Grid, list, or masonry — whichever helps you spot the keeper faster.
          </Feature>
          <Feature icon={IconAccept} title="Multi-select actions">
            Bulk download, delete, or attach as references. Built for sessions, not single shots.
          </Feature>
          <Feature icon={IconShield} title="Local-first, keys-local">
            Your API keys live in your browser. The only thing on a server is a thin Cloudflare
            Worker that proxies requests.
          </Feature>
          <Feature icon={IconSparkles} title="Prompt variations">
            Spawn N variants of a prompt with a text model, run them as a batch, keep what works.
          </Feature>
        </div>
      </section>

      {/* Models */}
      <section id="models" className="mx-auto max-w-300 px-7 py-24">
        <span className="text-accent-muted mb-4 inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase before:h-px before:w-3.5 before:bg-purple-500 before:content-['']">
          Models
        </span>
        <h2 className="mb-4 max-w-180 text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">
          If it has an API, it works.
        </h2>
        <p className="text-text-tertiary mb-12 max-w-150 text-[17px] leading-[1.55]">
          First-class support for the obvious ones. Trivial to add anything else — just paste a
          Replicate model URL.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <ModelTile color="#10a37f" name="gpt-image-1" vendor="OpenAI" />
          <ModelTile color="#4285f4" name="gemini-3.1-flash" vendor="Google" />
          <ModelTile color="#4285f4" name="imagen-3" vendor="Google" />
          <ModelTile color="#ff4f00" name="flux-1.1-pro" vendor="Replicate" />
          <ModelTile color="#ff4f00" name="flux-schnell" vendor="Replicate" />
          <ModelTile color="#ff4f00" name="sdxl-lightning" vendor="Replicate" />
          <ModelTile color="#ff4f00" name="ideogram-v2" vendor="Replicate" />
          <ModelTile color="#ff4f00" name="recraft-v3" vendor="Replicate" />
          <ModelTile color="#ff4f00" name="real-esrgan" vendor="Upscale" />
          <ModelTile color="#ff4f00" name="clarity-upscaler" vendor="Upscale" />
          <ModelTile color="#7c5bff" name="nano-banana" vendor="Edit" />
          <ModelTile color="#a855f7" name="+ paste any URL" vendor="Custom" />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-300 px-7 py-24">
        <span className="text-accent-muted mb-4 inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[0.18em] uppercase before:h-px before:w-3.5 before:bg-purple-500 before:content-['']">
          How it works
        </span>
        <h2 className="mb-4 max-w-180 text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-semibold tracking-[-0.03em]">
          From zero to generating in about ninety seconds.
        </h2>
        <p className="text-text-tertiary mb-12 max-w-150 text-[17px] leading-[1.55]">
          No accounts. No subscriptions. No image upload to a stranger's server.
        </p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="border-c-border rounded-[14px] border bg-[#0c0c11] p-6">
            <div className="text-accent-muted mb-3 font-mono text-xs">01 / Open</div>
            <h3 className="mb-2 text-lg font-semibold tracking-[-0.01em]">Open Paintball</h3>
            <p className="text-text-tertiary text-sm leading-[1.6]">
              It's a web app. Bookmark it, open it, you're in. No installer, no signup gate.
            </p>
          </div>
          <div className="border-c-border rounded-[14px] border bg-[#0c0c11] p-6">
            <div className="text-accent-muted mb-3 font-mono text-xs">02 / Paste keys</div>
            <h3 className="mb-2 text-lg font-semibold tracking-[-0.01em]">Paste your API keys</h3>
            <p className="text-text-tertiary text-sm leading-[1.6]">
              OpenAI, Google, Replicate. They're stored locally in your browser. Pull them out
              anytime.
            </p>
            <pre className="border-c-border mt-3.5 overflow-x-auto rounded-lg border bg-[#08080c] px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-[#c9c9d5]">
              <span className="text-[#7c7c8b]"># settings → keys</span>
              {"\n"}
              <span className="text-[#d8b4fe]">REPLICATE_KEY</span>=
              <span className="text-[#fda4af]">"r8_••••••••••"</span>
              {"\n"}
              <span className="text-[#d8b4fe]">OPENAI_KEY</span>=
              <span className="text-[#fda4af]">"sk-••••••••••"</span>
            </pre>
          </div>
          <div className="border-c-border rounded-[14px] border bg-[#0c0c11] p-6">
            <div className="text-accent-muted mb-3 font-mono text-xs">03 / Generate</div>
            <h3 className="mb-2 text-lg font-semibold tracking-[-0.01em]">
              Generate, edit, repeat
            </h3>
            <p className="text-text-tertiary text-sm leading-[1.6]">
              Type a prompt, pick the models you want to race, hit ⌘↩. Cherry-pick a winner, open it
              in the editor, keep going.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="get-started" className="mx-auto max-w-300 px-7 py-24">
        <div
          className="border-c-border relative overflow-hidden rounded-[20px] border bg-[#111118] px-10 py-16 text-center"
          style={{
            background:
              "radial-gradient(ellipse 60% 80% at 50% 0%, rgba(168,85,247,0.2), transparent 70%), #111118",
          }}
        >
          <h2 className="mb-3.5 text-[clamp(28px,4vw,44px)] font-semibold tracking-[-0.03em]">
            Stop juggling tabs. Generate everywhere from one place.
          </h2>
          <p className="text-text-tertiary mx-auto mb-7 max-w-130 text-base">
            Free, open source, runs in your browser. You bring the keys.
          </p>
          <div className="inline-flex flex-wrap justify-center gap-3">
            <Link
              to="/app"
              className="inline-flex items-center gap-2.5 rounded-[10px] bg-linear-to-b from-white to-[#e6e6ee] px-5.5 py-3 text-[15px] font-medium text-[#0a0a10] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_30px_-10px_rgba(255,255,255,0.25)] transition hover:-translate-y-px"
            >
              Open Paintball
              <IconArrow className="h-3.5 w-3.5" />
            </Link>
            <a
              href="https://github.com/the-snesler/paintball-ai"
              className="border-c-border inline-flex items-center gap-2.5 rounded-[10px] border bg-white/4 px-5.5 py-3 text-[15px] font-medium text-[#f4f4f7] transition hover:-translate-y-px hover:bg-white/8"
            >
              Read the source
            </a>
          </div>
        </div>
      </section>

      <footer className="border-c-border text-text-tertiary mx-auto mt-16 flex max-w-300 flex-wrap items-center gap-6 border-t px-7 pt-9 pb-16 text-[13px]">
        <span>© 2026 Paintball. MIT licensed.</span>
        <div className="ml-auto flex gap-6">
          <a href="#features" className="hover:text-text-primary transition-colors">
            Features
          </a>
          <a href="#models" className="hover:text-text-primary transition-colors">
            Models
          </a>
          <a
            href="https://github.com/the-snesler/paintball-ai"
            className="hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
