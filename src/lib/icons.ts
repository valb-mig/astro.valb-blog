export function iconName(slug: string): string {
  return `simple-icons:${slug}`;
}

export function faviconUrl(siteUrl: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(siteUrl)}`;
}
