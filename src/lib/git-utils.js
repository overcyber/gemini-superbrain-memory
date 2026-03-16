import { execSync } from 'node:child_process';
import path from 'node:path';

function runGitCommand(args, cwd) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function getGitRoot(cwd) {
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === 'true';

  try {
    if (isolateWorktrees) {
      const gitRoot = runGitCommand('rev-parse --show-toplevel', cwd);
      return gitRoot || null;
    }

    const gitCommonDir = runGitCommand('rev-parse --git-common-dir', cwd);

    if (!gitCommonDir) {
      return null;
    }

    if (gitCommonDir === '.git') {
      const gitRoot = runGitCommand('rev-parse --show-toplevel', cwd);
      return gitRoot || null;
    }

    const resolved = path.resolve(cwd, gitCommonDir);

    if (
      path.basename(resolved) === '.git' &&
      !resolved.includes(`${path.sep}.git${path.sep}`)
    ) {
      return path.dirname(resolved);
    }

    const gitRoot = runGitCommand('rev-parse --show-toplevel', cwd);
    return gitRoot || null;
  } catch {
    return null;
  }
}

function getGitRemoteUrl(cwd = process.cwd()) {
  return runGitCommand('remote get-url origin', cwd);
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
