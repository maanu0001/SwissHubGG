/**
 * Ermittelt aus einer eingegebenen Video-URL eine datenschutzfreundliche
 * Einbettungsadresse. Es werden nur bekannte Anbieter akzeptiert; alles andere
 * wird als einfacher Link dargestellt.
 */

export type EmbedInfo =
  | { kind: 'youtube'; embedUrl: string; externalUrl: string }
  | { kind: 'twitch'; embedUrl: string; externalUrl: string }
  | { kind: 'link'; externalUrl: string }
  | null;

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') {
    return url.pathname.slice(1) || null;
  }
  if (/(^|\.)youtube(-nocookie)?\.com$/.test(url.hostname)) {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
    return match?.[2] ?? null;
  }
  return null;
}

export function resolveEmbed(rawUrl: string, parentHost?: string): EmbedInfo {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const video = youtubeId(url);
  if (video && /^[\w-]{6,20}$/.test(video)) {
    return {
      kind: 'youtube',
      // nocookie-Domain: kein Tracking-Cookie vor dem Abspielen.
      embedUrl: `https://www.youtube-nocookie.com/embed/${video}?rel=0&modestbranding=1`,
      externalUrl: `https://www.youtube.com/watch?v=${video}`,
    };
  }

  if (/(^|\.)twitch\.tv$/.test(url.hostname)) {
    const parent = parentHost ?? 'localhost';
    const clip = url.pathname.match(/\/clip\/([\w-]+)/)?.[1] ?? url.searchParams.get('clip');
    if (clip) {
      return {
        kind: 'twitch',
        embedUrl: `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip)}&parent=${encodeURIComponent(parent)}`,
        externalUrl: url.toString(),
      };
    }

    const videoId = url.pathname.match(/\/videos\/(\d+)/)?.[1];
    if (videoId) {
      return {
        kind: 'twitch',
        embedUrl: `https://player.twitch.tv/?video=${videoId}&parent=${encodeURIComponent(parent)}&autoplay=false`,
        externalUrl: url.toString(),
      };
    }

    const channel = url.pathname.replace(/^\//, '').split('/')[0];
    if (channel && /^[\w-]{3,30}$/.test(channel)) {
      return {
        kind: 'twitch',
        embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(parent)}&autoplay=false`,
        externalUrl: url.toString(),
      };
    }
  }

  return { kind: 'link', externalUrl: url.toString() };
}
