import 'server-only';
import { prisma } from '@/lib/db';

/**
 * Zählt, wo ein Medium verwendet wird – Grundlage für die Warnung beim Löschen.
 *
 * Bewusst keine Server Action: Die Funktion wird ausschliesslich von Server
 * Components aufgerufen, die ihre Berechtigung bereits geprüft haben. Als
 * Export einer `'use server'`-Datei wäre sie ein ungeschützter Endpunkt.
 */
export async function mediaUsage(id: string): Promise<{ label: string; count: number }[]> {
  const [pagesSeo, tournamentBanner, tournamentSeo, tournamentGallery, sponsorLogos, socialThumbs, teamAvatars] =
    await Promise.all([
      prisma.page.count({ where: { seoImageId: id } }),
      prisma.tournament.count({ where: { bannerId: id } }),
      prisma.tournament.count({ where: { seoImageId: id } }),
      prisma.tournamentMedia.count({ where: { mediaId: id } }),
      prisma.sponsor.count({ where: { logoId: id } }),
      prisma.socialPost.count({ where: { thumbnailId: id } }),
      prisma.teamMember.count({ where: { avatarId: id } }),
    ]);

  return [
    { label: 'Seiten (Social-Bild)', count: pagesSeo },
    { label: 'Turnierbanner', count: tournamentBanner },
    { label: 'Turniere (Social-Bild)', count: tournamentSeo },
    { label: 'Turniergalerien', count: tournamentGallery },
    { label: 'Sponsorenlogos', count: sponsorLogos },
    { label: 'Social-Beiträge', count: socialThumbs },
    { label: 'Teammitglieder', count: teamAvatars },
  ].filter((entry) => entry.count > 0);
}
