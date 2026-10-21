import { Linking } from 'react-native';
import Constants from 'expo-constants';

export const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';
const GITHUB_REPO = 'ikeshav26/OccupEye';

export interface AppReleaseInfo {
  version: string;
  hasUpdate: boolean;
  downloadUrl: string | null;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
}

export function compareSemver(vLatest: string, vCurrent: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  const l = parse(vLatest);
  const c = parse(vCurrent);
  const len = Math.max(l.length, c.length);

  for (let i = 0; i < len; i++) {
    const numL = l[i] || 0;
    const numC = c[i] || 0;
    if (numL > numC) return 1;
    if (numL < numC) return -1;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<AppReleaseInfo> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return {
        version: CURRENT_VERSION,
        hasUpdate: false,
        downloadUrl: null,
        releaseName: '',
        releaseNotes: '',
        publishedAt: '',
      };
    }

    const data = await res.json();
    const latestTag = data.tag_name || '';
    const cleanLatest = latestTag.replace(/^v/, '');

    const hasUpdate = compareSemver(cleanLatest, CURRENT_VERSION) > 0;

    let downloadUrl: string | null = null;
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find((a: { name?: string }) => a.name?.endsWith('.apk'));
      if (apkAsset) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    if (!downloadUrl) {
      downloadUrl = data.html_url || `https://github.com/${GITHUB_REPO}/releases`;
    }

    return {
      version: cleanLatest || CURRENT_VERSION,
      hasUpdate,
      downloadUrl,
      releaseName: data.name || latestTag,
      releaseNotes: data.body || '',
      publishedAt: data.published_at || '',
    };
  } catch (error) {
    console.warn('[Updater] Check failed:', error);
    return {
      version: CURRENT_VERSION,
      hasUpdate: false,
      downloadUrl: null,
      releaseName: '',
      releaseNotes: '',
      publishedAt: '',
    };
  }
}

export async function downloadAndInstallUpdate(downloadUrl: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(downloadUrl);
    if (canOpen) {
      await Linking.openURL(downloadUrl);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Updater] Install trigger failed:', err);
    return false;
  }
}
