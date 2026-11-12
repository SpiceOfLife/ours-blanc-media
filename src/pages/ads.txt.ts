// AdSense ads.txt — generated from PUBLIC_ADSENSE_CLIENT (ca-pub-XXXX) at build time.
export const GET = () => {
  const c = (import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '').replace(/^ca-/, '');
  return new Response(c ? `google.com, ${c}, DIRECT, f08c47fec0942fa0\n` : '# AdSense not configured yet\n');
};
