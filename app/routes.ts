import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("routes/landing.tsx"),
  ...prefix("app", [
    layout("routes/home.tsx", [
      index("routes/gallery.tsx"),
      route("timeline", "routes/timeline.tsx"),
      route("settings", "routes/settings.tsx"),
      route("editor", "routes/editor.tsx"),
      route("characters/new", "routes/characterEdit.tsx", { id: "character-new" }),
      route("characters/:id", "routes/characterEdit.tsx", { id: "character-edit" }),
    ]),
  ]),
] satisfies RouteConfig;
