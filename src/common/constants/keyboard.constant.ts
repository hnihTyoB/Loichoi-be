export const KEYBOARD_PLATFORM = {
  IOS: 'IOS',
  ANDROID: 'ANDROID',
  BOTH: 'BOTH',
} as const;

export type KeyboardPlatform = keyof typeof KEYBOARD_PLATFORM;

export const KEYBOARD_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
} as const;

export type KeyboardStatus = keyof typeof KEYBOARD_STATUS;

export const KEYBOARD_SORT = {
  LATEST: 'LATEST',
  POPULAR: 'POPULAR',
  NAME_ASC: 'NAME_ASC',
  NAME_DESC: 'NAME_DESC',
} as const;

export type KeyboardSort = keyof typeof KEYBOARD_SORT;

export const THEME_ACCESS_LEVEL = {
  FREE: 'FREE',
  DISCORD_MEMBER: 'DISCORD_MEMBER',
  DISCORD_ROLE: 'DISCORD_ROLE',
} as const;

export type ThemeAccessLevel = keyof typeof THEME_ACCESS_LEVEL;

export function isGoogleDriveUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'drive.google.com' ||
      hostname === 'docs.google.com'
    );
  } catch {
    return false;
  }
}
