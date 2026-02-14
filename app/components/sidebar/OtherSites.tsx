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
      className={`w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 group-hover:border transition`}
      style={{ color: site.color, borderColor: site.color }}
    >
      <SVG src={site.icon} className="w-4 h-4" />
    </div>
    <div>
      <h1 className="font-semibold text-sm">{site.name}</h1>
      <p className="text-xs text-zinc-500">{site.description}</p>
    </div>
  </div>
);

export const OtherSites = () => (
  <div
    popover="auto"
    id="other-sites-popover"
    className="flex-col flex m-2 w-76 rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg open:animate-in fade-in zoom-in-90 not-open:animate-out fade-out zoom-out-90 fill-mode-forwards not-open:pointer-events-none z-50"
  >
    {otherSites.map((site) =>
      site.internalLink ? (
        <button
          key={site.name}
          className="px-4 py-2 flex items-center justify-between border-b border-zinc-800 h-16 text-left hover:bg-zinc-800 transition-colors w-full hover:cursor-pointer group"
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
          className="px-4 py-2 flex items-center justify-between border-b border-zinc-800 h-16 hover:bg-zinc-800 transition-colors w-full group"
        >
          <InnerLinkButton site={site} />
        </a>
      ),
    )}
  </div>
);
