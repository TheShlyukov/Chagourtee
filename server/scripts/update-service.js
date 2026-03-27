#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script to update the Chagourtee service
 * Checks for the latest available tag and offers to update if there's a newer version
 */

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

function colorize(color, text) {
  return colors[color] + text + colors.reset;
}

function runCommand(command, cwd = process.cwd()) {
  try {
    return execSync(command, { encoding: 'utf8', cwd });
  } catch (error) {
    console.error(`${colorize('red', 'Error executing command:')} ${command}`);
    console.error(`${colorize('red', error.message)}`);
    throw error;
  }
}

function isServerRunning() {
  try {
    // Detect platform and run appropriate command to check for running server
    if (process.platform === 'win32') {
      const result = runCommand('netstat -ano | findstr :3000');
      return result.includes('LISTENING');
    } else {
      // Unix-like systems (Linux/macOS)
      const result = execSync('lsof -i :3000', { encoding: 'utf8' });
      return result.includes('LISTEN');
    }
  } catch (error) {
    // If the command fails (e.g., no process on port 3000), we assume the server is not running
    return false;
  }
}

function getCurrentVersion() {
  const rootPackageJsonPath = path.join(__dirname, '../../package.json');
  const serverPackageJsonPath = path.join(__dirname, '../../server/package.json');
  
  if (fs.existsSync(rootPackageJsonPath)) {
    const rootPackage = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
    return rootPackage.version || 'unknown';
  }
  
  if (fs.existsSync(serverPackageJsonPath)) {
    const serverPackage = JSON.parse(fs.readFileSync(serverPackageJsonPath, 'utf8'));
    return serverPackage.version || 'unknown';
  }
  
  return 'unknown';
}

function getLatestRemoteTags() {
  console.log(colorize('cyan', 'Fetching latest remote tags...'));
  const output = runCommand('git ls-remote --tags origin');
  
  // Parse the output to extract tags
  const tagRegex = /refs\/tags\/(.+)$/gm;
  const matches = [];
  let match;
  
  while ((match = tagRegex.exec(output)) !== null) {
    const tag = match[1];
    // Skip the ^{} suffix that refers to annotated tag objects
    if (!tag.endsWith('^{}')) {
      matches.push(tag);
    }
  }
  
  // Remove duplicates and sort tags by semantic version
  const uniqueTags = [...new Set(matches)];
  uniqueTags.sort(compareSemverVersions); // Ascending order, so we'll take the last element
  
  return uniqueTags;
}

/**
 * Compares two semantic version strings following SemVer specification
 * @param {string} v1 - First version string
 * @param {string} v2 - Second version string
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareSemverVersions(v1, v2) {
  // Handle the case where one or both versions are falsy
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  // Normalize versions by removing leading 'v' if present
  const normalize = (version) => {
    // Handle pre- versions specially - they indicate development versions
    if (version.startsWith('pre-v')) {
      // Remove 'pre-' prefix but remember it was a pre version
      return { version: version.substring(4), isPre: true }; // remove 'pre-' prefix
    }
    
    // Regular version without pre- prefix
    return { version: version.replace(/^v/i, ''), isPre: false };
  };
  
  const normV1 = normalize(v1);
  const normV2 = normalize(v2);
  
  // If one is a pre- version and the other isn't, the pre- version is greater
  if (normV1.isPre && !normV2.isPre) return 1;
  if (!normV1.isPre && normV2.isPre) return -1;
  
  const cleanV1 = normV1.version;
  const cleanV2 = normV2.version;

  // Split by '-' to separate core version and pre-release identifiers
  const [v1Core, v1PreRelease] = cleanV1.split('-');
  const [v2Core, v2PreRelease] = cleanV2.split('-');
  
  // Split core version by dots and parse each part as a number
  const v1Parts = v1Core.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  const v2Parts = v2Core.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  // Compare major.minor.patch... numerically (supporting extended version formats)
  const maxLen = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLen; i++) {
    const val1 = i < v1Parts.length ? v1Parts[i] : 0;
    const val2 = i < v2Parts.length ? v2Parts[i] : 0;
    
    if (val1 < val2) return -1;
    if (val1 > val2) return 1;
  }
  
  // Core versions are equal, now check pre-release
  if (!v1PreRelease && !v2PreRelease) return 0;  // Both are release versions
  if (!v1PreRelease) return 1;  // v1 is a release, v2 is pre-release -> v1 is greater
  if (!v2PreRelease) return -1; // v2 is a release, v1 is pre-release -> v2 is greater
  
  // Both are pre-release versions, compare pre-release identifiers
  const pr1Parts = v1PreRelease.split('.');
  const pr2Parts = v2PreRelease.split('.');
  
  for (let i = 0; i < Math.max(pr1Parts.length, pr2Parts.length); i++) {
    const p1 = i < pr1Parts.length ? pr1Parts[i] : undefined;
    const p2 = i < pr2Parts.length ? pr2Parts[i] : undefined;
    
    if (p1 === p2) continue;
    if (!p1) return 1;  // v1 has fewer pre-release parts, so it's greater
    if (!p2) return -1; // v2 has fewer pre-release parts, so it's greater
    
    // Compare as numbers if both are numeric, otherwise as strings
    const n1 = Number(p1);
    const n2 = Number(p2);
    
    if (!isNaN(n1) && !isNaN(n2)) {
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    } else {
      // String comparison for non-numeric identifiers
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
  }
  
  return 0;
}

function getLatestAvailableVersion(remoteTags) {
  // Filter out invalid tags and return the latest one
  // Updated regex to match version patterns with 3+ numeric segments like v0.0.0.0-alpha
  const validTags = remoteTags.filter(tag => 
    /^v\d+\.\d+\.\d+(\.\d+)*(-[a-zA-Z0-9.-]+)?$/.test(tag) || 
    /^pre-v\d+\.\d+\.\d+(\.\d+)*(-[a-zA-Z0-9.-]+)?$/.test(tag)
  );
  
  // Since the tags are sorted in ascending order, the last one is the greatest
  return validTags.length > 0 ? validTags[validTags.length - 1] : null;
}

function isUpdateAvailable(currentVersion, latestVersion) {
  if (!latestVersion) return false;
  
  // Compare versions using our semantic version comparison
  const comparisonResult = compareSemverVersions(currentVersion, latestVersion);
  
  // An update is available if the latest version is greater than current
  return comparisonResult < 0;
}

function performUpdate(targetVersion, skipDependencies = false) {
  try {
    console.log(colorize('blue', `\nUpdating to version: ${targetVersion}...`));
    
    // Check if we're on a clean working directory
    const statusOutput = runCommand('git status --porcelain');
    if (statusOutput.trim() !== '') {
      console.error(colorize('red', 'Error: Your working directory is not clean. Please commit or stash your changes before updating.'));
      return false;
    }
    
    // Ensure we're on the main branch
    const currentBranch = runCommand('git rev-parse --abbrev-ref HEAD').trim();
    if (currentBranch !== 'main' && currentBranch !== 'master') {
      console.log(colorize('yellow', `Switching to main branch...`));
      runCommand('git checkout main || git checkout master');
    }
    
    // Pull the latest changes
    console.log(colorize('green', 'Pulling latest changes...'));
    runCommand('git pull origin ' + (currentBranch === 'master' ? 'master' : 'main'));
    
    // Check if the tag exists locally
    let localTagExists = false;
    try {
      const localTags = runCommand('git tag -l').split('\n');
      localTagExists = localTags.some(tag => tag.trim() === targetVersion);
    } catch (e) {
      // If command fails, assume tag doesn't exist locally
    }
    
    // Fetch the latest changes if tag doesn't exist locally
    if (!localTagExists) {
      console.log(colorize('green', 'Fetching latest tags...'));
      runCommand('git fetch --all --tags');
    }
    
    // Checkout the target tag
    console.log(colorize('blue', `Checking out ${targetVersion}...`));
    runCommand(`git checkout ${targetVersion}`);
    
    // Install dependencies unless explicitly skipped
    if (!skipDependencies) {
      console.log(colorize('green', 'Installing root dependencies...'));
      runCommand('npm install');
      
      // If workspaces exist, install dependencies in workspaces too
      const rootPackagePath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(rootPackagePath)) {
        const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
        if (rootPackage.workspaces) {
          console.log(colorize('green', 'Installing workspace dependencies...'));
          rootPackage.workspaces.forEach(workspace => {
            const workspacePath = path.join(__dirname, '../../', workspace);
            if (fs.existsSync(workspacePath)) {
              console.log(colorize('green', `Installing dependencies for ${workspace}...`));
              runCommand('npm install', workspacePath);
            }
          });
        }
      }
    } else {
      console.log(colorize('yellow', '⚠️  Dependency installation skipped. This could break functionality if dependencies have changed!\nBut you can still manually install the dependencies if needed with `npm install` in root directory and in each workspace directory.'));
    }
    
    console.log(colorize('bold', colorize('green', `\nSuccessfully updated to version: ${targetVersion}`)));
    return true;
  } catch (error) {
    console.error(colorize('red', 'Update failed:'), colorize('red', error.message));
    // Try to return to the original state
    try {
      runCommand('git checkout -'); // Return to previous branch
    } catch (e) {
      // Ignore error during rollback
    }
    return false;
  }
}

function main() {
  console.log(colorize('bold', colorize('bgBlue', ' '.repeat(54))));
  console.log(colorize('bold', colorize('bgBlue', '           CHAGOURTEE SERVICE UPDATE SCRIPT           ')));
  console.log(colorize('bold', colorize('bgBlue', ' '.repeat(54))));
  console.log('');
  
  try {
    // Verify we're in a git repository
    runCommand('git status');
    
    const currentVersion = getCurrentVersion();
    console.log(colorize('cyan', `Current version:`) + ' ' + colorize('bold', currentVersion));
    
    // Check if server is currently running
    if (isServerRunning()) {
      console.log('\n' + colorize('bgYellow', ' WARNING '));
      console.log(colorize('yellow', 'Server appears to be running! There is a risk that npm install may fail or cause issues.'));
      console.log(colorize('yellow', 'It is recommended to stop the server before updating.'));
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question(
        colorize('magenta', 'Do you want to continue anyway? (This is safe if the update contains only minor changes without new dependencies) (y/N): '),
        (answer) => {
          if (!answer.toLowerCase().startsWith('y')) {
            console.log(colorize('red', 'Update cancelled by user.'));
            rl.close();
            return;
          }
          
          rl.close();
          performUpdateCheck(currentVersion);
        }
      );
    } else {
      performUpdateCheck(currentVersion);
    }
  } catch (error) {
    console.error(colorize('red', 'Error during update check:'), colorize('red', error.message));
    process.exit(1);
  }
}

function performUpdateCheck(currentVersion) {
  try {
    const remoteTags = getLatestRemoteTags();
    const latestVersion = getLatestAvailableVersion(remoteTags);
    
    if (!latestVersion) {
      console.log(colorize('yellow', 'No remote tags found.'));
      return;
    }
    
    console.log(colorize('cyan', `Latest available version:`) + ' ' + colorize('bold', latestVersion));
    
    if (isUpdateAvailable(currentVersion, latestVersion)) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question(
        colorize('green', `\nA new version (${colorize('bold', latestVersion)}) is available. Would you like to update? (y/N): `),
        (answer) => {
          if (answer.toLowerCase().startsWith('y')) {
            rl.question(
              colorize('yellow', `\nSkip dependency installation? (Only do this for minor updates that you're sure don't require dependency changes)\nSkipping dependencies can break functionality if dependencies have changed!\nType 'YES' in all caps to confirm skipping dependencies: `),
              (skipAnswer) => {
                const skipDependencies = skipAnswer === 'YES';
                
                if (skipDependencies) {
                  console.log(colorize('red', '\n⚠️  You have chosen to skip dependency installation.'));
                  console.log(colorize('red', 'This may cause issues if the update requires new dependencies or changes existing ones.'));
                }
                
                const success = performUpdate(latestVersion, skipDependencies);
                
                if (success) {
                  console.log(colorize('bold', colorize('green', '\nUpdate completed successfully!')));
                } else {
                  console.log(colorize('red', 'Update failed. Please check the errors above.'));
                }
                
                rl.close();
              }
            );
          } else {
            console.log(colorize('yellow', 'Update cancelled by user.'));
            rl.close();  // Make sure to close the readline interface when cancelling
          }
          
          rl.close();
        }
      );
    } else {
      console.log(colorize('green', 'You are already on the latest version or a development version newer than the latest release.'));
    }
  } catch (error) {
    console.error(colorize('red', 'Error during update check:'), colorize('red', error.message));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getCurrentVersion,
  getLatestRemoteTags,
  getLatestAvailableVersion,
  isUpdateAvailable,
  performUpdate
};