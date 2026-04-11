interface Env {
  ASSETS: Fetcher;
}

function isHtmlNavigationRequest(request: Request): boolean {
  const accepts = request.headers.get("accept") || "";
  return (request.method === "GET" || request.method === "HEAD") && accepts.includes("text/html");
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() || "";
  return lastSegment.includes(".");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle /proxy/replicate/* routes
    if (url.pathname.startsWith("/proxy/replicate/")) {
      const targetPath = url.pathname.replace("/proxy/replicate", "");
      const targetUrl = `https://api.replicate.com${targetPath}`;

      // Forward the request to Replicate
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Serve static assets first.
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback: serve index.html for browser route navigations.
    if (isHtmlNavigationRequest(request) && !hasFileExtension(url.pathname)) {
      const indexUrl = new URL("/index.html", url);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return assetResponse;
  },
};
