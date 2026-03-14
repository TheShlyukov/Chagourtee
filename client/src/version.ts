/**
 * Client Version Information Utilities
 * 
 * This file provides utilities for handling version information on the client side.
 * It works with the server-provided version information.
 */

export interface VersionInfo {
  version: string;
  name: string;
  release: string;
}

/**
 * Parses the version string to extract release type
 * @param version The version string (e.g. "0.1.1-alpha", "1.0.0", "v0.3.1-alpha")
 * @returns The release type ('alpha', 'beta', 'rc', 'pre', 'stable')
 */
export function getReleaseType(version: string): string {
  if (!version) return 'stable';
  
  // Special handling for 'pre-' prefix which indicates intermediate development stage
  if (version.startsWith('pre-')) {
    return 'pre';
  }
  
  // Look for common pre-release identifiers
  const prereleaseMatch = version.match(/-([a-zA-Z]+)(?:\.?\d*)?/);
  if (prereleaseMatch && prereleaseMatch[1]) {
    const prereleaseType = prereleaseMatch[1].toLowerCase();
    return ['alpha', 'beta', 'rc'].includes(prereleaseType) ? prereleaseType : 'pre';
  }
  
  return 'stable';
}

/**
 * Formats the version display string
 */
export function formatVersionDisplay(versionInfo: VersionInfo): string {
  return `${versionInfo.name} ${versionInfo.version}`;
}

/**
 * Checks if current version is a pre-release
 */
export function isPreRelease(versionInfo: VersionInfo): boolean {
  return versionInfo.release !== 'stable';
}

/**
 * Compares two version strings
 * Returns 1 if version1 > version2, -1 if version1 < version2, 0 if equal
 */
export function compareVersions(version1: string, version2: string): number {
  if (!version1 || !version2) {
    return 0;
  }
  
  // Remove any pre-release identifiers for base comparison
  const cleanVersion1 = version1.split('-')[0] || '';
  const cleanVersion2 = version2.split('-')[0] || '';
  
  // Handle 'pre-' prefix by extracting actual version part
  const actualVersion1 = cleanVersion1.startsWith('pre-') ? cleanVersion1.substring(4) : cleanVersion1;
  const actualVersion2 = cleanVersion2.startsWith('pre-') ? cleanVersion2.substring(4) : cleanVersion2;
  
  // Split and convert to numbers, handling potential NaN values
  const parts1 = actualVersion1 
    ? actualVersion1.split('.').map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      })
    : [0];
    
  const parts2 = actualVersion2
    ? actualVersion2.split('.').map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      })
    : [0];
  
  // Compare each part
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1 = i < parts1.length ? parts1[i] : 0;
    const v2 = i < parts2.length ? parts2[i] : 0;
    
    // Explicitly check for undefined values
    if (v1 === undefined || v2 === undefined) {
      return 0;
    }
    
    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }
  
  // If base versions are equal, compare pre-release identifiers
  const prerelease1 = version1.includes('-') ? (version1.split('-')[1] || '') : '';
  const prerelease2 = version2.includes('-') ? (version2.split('-')[1] || '') : '';
  
  if (prerelease1 && !prerelease2) return -1; // version with prerelease is "less"
  if (!prerelease1 && prerelease2) return 1;  // version without prerelease is "more"
  if (prerelease1 > prerelease2) return 1;
  if (prerelease1 < prerelease2) return -1;
  
  return 0;
}