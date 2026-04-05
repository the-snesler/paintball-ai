import SVG from "react-inlinesvg";
import drop from "~/drop.svg";
import camera from "~/camera.svg";

interface Site {
  name: string;
  description: string;
  url: string;
  internalLink: boolean; // just close the popover without redirecting anywhere
  icon: string;
  color: string;
}
const otherSites: Site[] = [
  {
    name: "Paintball",
    description: "AI Image Generator",
    url: "#",
    internalLink: true,
    icon: drop,
    color: "#c27aff",
  },
  {
    name: "SimpleGIF",
    description: "GIF creator and editor",
    url: "https://simplegif.samnesler.com",
    internalLink: false,
    icon: camera,
    color: "#05df72",
  },
];

const InnerLinkButton = ({ site }: { site: Site }) => (
  <div className="flex items-center gap-3">
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 transition group-hover:border group-hover:bg-zinc-700`}
      style={{ color: site.color, borderColor: site.color }}
    >
      <SVG src={site.icon} className="h-4 w-4" />
    </div>
    <div>
      <h1 className="text-sm font-semibold">{site.name}</h1>
      <p className="text-xs text-zinc-500">{site.description}</p>
    </div>
  </div>
);

export const OtherSites = () => (
  <div
    popover="auto"
    id="other-sites-popover"
    className="open:animate-in fade-in zoom-in-90 not-open:animate-out fade-out zoom-out-90 fill-mode-forwards z-50 m-2 flex w-76 flex-col rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg not-open:pointer-events-none"
  >
    {otherSites.map((site) =>
      site.internalLink ? (
        <button
          key={site.name}
          className="group flex h-16 w-full items-center justify-between border-b border-zinc-800 px-4 py-2 text-left transition-colors hover:cursor-pointer hover:bg-zinc-800"
          popoverTarget="other-sites-popover"
          popoverTargetAction="hide"
        >
          <InnerLinkButton site={site} />
        </button>
      ) : (
        <a
          key={site.name}
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex h-16 w-full items-center justify-between border-b border-zinc-800 px-4 py-2 transition-colors hover:bg-zinc-800"
        >
          <InnerLinkButton site={site} />
        </a>
      )
    )}
  </div>
);
