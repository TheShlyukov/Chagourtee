/**
 * Application Version Information
 * 
 * This file serves as a utility module for application version information.
 * It reads the version directly from package.json as per specification.
 * NOTE: According to the specification, this file should only provide utilities,
 * the actual version string must come directly from package.json without duplication or modification.
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json directly - this is the single source of truth
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
const packageJson = JSON.parse(packageJsonContent);

// The version should be read as-is from package.json according to specifications
const APP_VERSION = packageJson.version;
// Use fixed application name instead of package name to show "Chagourtee" as required
const APP_NAME = 'Chagourtee';

/**
 * Parses the version string to extract release type
 * @param {string} version - The version string (e.g. "0.1.1-alpha", "1.0.0", "v0.3.2.1-alpha")
 * @returns {string} The release type ('alpha', 'beta', 'rc', 'pre', 'stable')
 */
function getReleaseType(version) {
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
 * Returns formatted version information
 */
function getVersionInfo() {
  return {
    version: APP_VERSION,
    name: APP_NAME, // Use fixed application name
    release: getReleaseType(APP_VERSION)
  };
}

module.exports = {
  APP_VERSION,
  APP_NAME,
  getReleaseType,
  getVersionInfo
};