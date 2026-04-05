import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
	layout("routes/home.tsx", [
		index("routes/gallery.tsx"),
		route("settings", "routes/settings.tsx"),
		route("editor", "routes/editor.tsx"),
	]),
] satisfies RouteConfig;
