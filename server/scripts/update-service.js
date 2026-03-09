#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script to update the Chagourtee service
 * Checks for the latest available tag and offers to update if there's a newer version
 */

function runCommand(command, cwd = process.cwd()) {
  try {
    return execSync(command, { encoding: 'utf8', cwd });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    throw error;
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
  console.log('Fetching latest remote tags...');
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
  const normalize = (version) => version.replace(/^v/i, '');
  
  const cleanV1 = normalize(v1);
  const cleanV2 = normalize(v2);

  // Split by dots to get major.minor.patch
  const [v1Core, v1PreRelease] = cleanV1.split('-');
  const [v2Core, v2PreRelease] = cleanV2.split('-');
  
  const v1Parts = v1Core.split('.').map(Number);
  const v2Parts = v2Core.split('.').map(Number);
  
  // Compare major.minor.patch numerically
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
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
  const validTags = remoteTags.filter(tag => 
    /^v\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(tag) || 
    /^pre-v\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(tag)
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

function performUpdate(targetVersion) {
  try {
    console.log(`Updating to version: ${targetVersion}...`);
    
    // Check if we're on a clean working directory
    const statusOutput = runCommand('git status --porcelain');
    if (statusOutput.trim() !== '') {
      console.error('Error: Your working directory is not clean. Please commit or stash your changes before updating.');
      return false;
    }
    
    // Ensure we're on the main branch
    const currentBranch = runCommand('git rev-parse --abbrev-ref HEAD').trim();
    if (currentBranch !== 'main' && currentBranch !== 'master') {
      console.log(`Switching to main branch...`);
      runCommand('git checkout main || git checkout master');
    }
    
    // Pull the latest changes
    console.log('Pulling latest changes...');
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
      console.log('Fetching latest tags...');
      runCommand('git fetch --all --tags');
    }
    
    // Checkout the target tag
    console.log(`Checking out ${targetVersion}...`);
    runCommand(`git checkout ${targetVersion}`);
    
    // Install dependencies
    console.log('Installing root dependencies...');
    runCommand('npm install');
    
    // If workspaces exist, install dependencies in workspaces too
    const rootPackagePath = path.join(__dirname, '../../package.json');
    if (fs.existsSync(rootPackagePath)) {
      const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
      if (rootPackage.workspaces) {
        console.log('Installing workspace dependencies...');
        rootPackage.workspaces.forEach(workspace => {
          const workspacePath = path.join(__dirname, '../../', workspace);
          if (fs.existsSync(workspacePath)) {
            console.log(`Installing dependencies for ${workspace}...`);
            runCommand('npm install', workspacePath);
          }
        });
      }
    }
    
    console.log(`Successfully updated to version: ${targetVersion}`);
    return true;
  } catch (error) {
    console.error('Update failed:', error.message);
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
  console.log('Chagourtee Service Update Script');
  console.log('===============================');
  
  try {
    // Verify we're in a git repository
    runCommand('git status');
    
    const currentVersion = getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);
    
    const remoteTags = getLatestRemoteTags();
    const latestVersion = getLatestAvailableVersion(remoteTags);
    
    if (!latestVersion) {
      console.log('No remote tags found.');
      return;
    }
    
    console.log(`Latest available version: ${latestVersion}`);
    
    if (isUpdateAvailable(currentVersion, latestVersion)) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question(
        `A new version (${latestVersion}) is available. Would you like to update? (y/N): `,
        (answer) => {
          if (answer.toLowerCase().startsWith('y')) {
            const success = performUpdate(latestVersion);
            
            if (success) {
              console.log('Update completed successfully!');
            } else {
              console.log('Update failed. Please check the errors above.');
            }
          } else {
            console.log('Update cancelled by user.');
          }
          
          rl.close();
        }
      );
    } else {
      console.log('You are already on the latest version or a development version newer than the latest release.');
    }
  } catch (error) {
    console.error('Error during update check:', error.message);
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