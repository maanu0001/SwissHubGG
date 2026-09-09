import type { SocialPlatform, SocialPostType } from '@prisma/client';
import { Icons } from '@/components/ui/Icon';

/** Darstellungsdaten der unterstützten Plattformen. */
export const SOCIAL_PLATFORM_META: Record<
  SocialPlatform,
  { label: string; icon: typeof Icons.discord; description: string }
> = {
  DISCORD: {
    label: 'Discord',
    icon: Icons.discord,
    description: 'Der zentrale Treffpunkt der Community.',
  },
  INSTAGRAM: {
    label: 'Instagram',
    icon: Icons.instagram,
    description: 'Bilder und Neuigkeiten aus der Community.',
  },
  TIKTOK: {
    label: 'TikTok',
    icon: Icons.tiktok,
    description: 'Kurzvideos und Clips aus Events und Turnieren.',
  },
  YOUTUBE: {
    label: 'YouTube',
    icon: Icons.youtube,
    description: 'Rückblicke, Highlights und längere Videos.',
  },
  TWITCH: {
    label: 'Twitch',
    icon: Icons.twitch,
    description: 'Livestreams von Turnieren und Community-Abenden.',
  },
  OTHER: {
    label: 'Weitere Plattform',
    icon: Icons.external,
    description: 'Weiterer Kanal der Community.',
  },
};

export const SOCIAL_POST_TYPE_LABEL: Record<SocialPostType, string> = {
  POST: 'Beitrag',
  VIDEO: 'Video',
  CLIP: 'Clip',
  STREAM: 'Stream',
  ANNOUNCEMENT: 'Ankündigung',
};
