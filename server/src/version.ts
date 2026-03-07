/**
 * Application Version Information
 * 
 * This file serves as the single source of truth for application version information.
 * It reads the version from package.json and provides utilities for version parsing.
 */

import fs from 'fs';
import path from 'path';

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
const packageJson = JSON.parse(packageJsonContent);

export const APP_VERSION = packageJson.version;
export const APP_NAME = packageJson.name || 'Chagourtee';

/**
 * Parses the version string to extract release type
 * @param version The version string (e.g. "0.1.1-alpha", "1.0.0")
 * @returns The release type ('alpha', 'beta', 'rc', 'stable')
 */
export function getReleaseType(version: string): string {
  if (!version) return 'stable';
  
  // Look for common pre-release identifiers
  const prereleaseMatch = version.match(/-([a-zA-Z]+)(?:\.?\d*)?/);
  if (prereleaseMatch && prereleaseMatch[1]) {
    const prereleaseType = prereleaseMatch[1].toLowerCase();
    return ['alpha', 'beta', 'rc'].includes(prereleaseType) ? prereleaseType : 'pre';
  }
  
  return 'stable';
}

/**
 * Returns formatted version information
 */
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    name: APP_NAME.replace('@chagourtee/', ''), // Clean the name for display
    release: getReleaseType(APP_VERSION)
  };
}