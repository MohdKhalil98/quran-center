export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // For non-API requests, serve index.html for SPA routing
    if (!url.pathname.startsWith('/api/') && !url.pathname.match(/\.\w+$/)) {
      return new Response(
        await new Response(await fetch(`${url.origin}/index.html`)).text(),
        {
          headers: { 'content-type': 'text/html' },
        }
      );
    }
    
    return fetch(request);
  },
};
