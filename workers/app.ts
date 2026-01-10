interface Env {
  ASSETS: Fetcher;
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

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  },
};
