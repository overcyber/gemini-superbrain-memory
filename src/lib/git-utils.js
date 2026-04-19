import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runGitCommand(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function findGitEntry(startDir) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const gitEntryPath = path.join(currentDir, '.git');

    if (fs.existsSync(gitEntryPath)) {
      return {
        worktreeRoot: currentDir,
        gitEntryPath,
      };
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function resolveGitDir(gitEntryPath) {
  try {
    const stat = fs.statSync(gitEntryPath);

    if (stat.isDirectory()) {
      return gitEntryPath;
    }

    if (!stat.isFile()) {
      return null;
    }

    const raw = fs.readFileSync(gitEntryPath, 'utf-8').trim();
    const match = raw.match(/^gitdir:\s*(.+)$/i);

    if (!match) {
      return null;
    }

    return path.resolve(path.dirname(gitEntryPath), match[1].trim());
  } catch {
    return null;
  }
}

function getGitRoot(cwd) {
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === 'true';
  const gitEntry = findGitEntry(cwd);

  if (!gitEntry) {
    return null;
  }

  if (isolateWorktrees) {
    return gitEntry.worktreeRoot;
  }

  const gitDir = resolveGitDir(gitEntry.gitEntryPath);

  if (!gitDir) {
    return gitEntry.worktreeRoot;
  }

  if (
    path.basename(gitDir) === '.git' &&
    !gitDir.includes(`${path.sep}.git${path.sep}`)
  ) {
    return path.dirname(gitDir);
  }

  const worktreesMarker = `${path.sep}.git${path.sep}worktrees${path.sep}`;
  const markerIndex = gitDir.indexOf(worktreesMarker);

  if (markerIndex !== -1) {
    return gitDir.slice(0, markerIndex);
  }

  return gitEntry.worktreeRoot;
}

function getGitRemoteUrl(cwd = process.cwd()) {
  return runGitCommand(['remote', 'get-url', 'origin'], cwd);
}

function getGitRepoName(cwd = process.cwd()) {
  const remoteUrl = getGitRemoteUrl(cwd);

  if (!remoteUrl) {
    return null;
  }

  const match = remoteUrl.match(/[/:]([^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

export { getGitRoot, getGitRemoteUrl, getGitRepoName };
