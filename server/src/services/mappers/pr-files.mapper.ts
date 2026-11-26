import type { DiffLine, PrFileChange, PrFiles } from '@pr-manager/contracts';
import type { GitHubPullRequestFile } from '../../accessors/github/github.types';

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
/** GitHub's documented cap on files returned for one PR. */
export const GITHUB_MAX_FILES = 3000;

/** Parses a unified-diff patch (as GitHub returns it, without file headers) into numbered lines. */
export function parsePatch(patch: string): DiffLine[] {
  const raw = patch.split('\n');
  if (raw.at(-1) === '') {
    raw.pop();
  }

  const lines: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const line of raw) {
    if (line.startsWith('@@')) {
      const m = HUNK_HEADER.exec(line);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      lines.push({ type: 'hunk', oldLine: null, newLine: null, text: line, commentable: false });
    } else if (line.startsWith('\\')) {
      // "\ No newline at end of file"
      continue;
    } else if (line.startsWith('+')) {
      lines.push({ type: 'add', oldLine: null, newLine: newNo++, text: line.slice(1), commentable: true });
    } else if (line.startsWith('-')) {
      lines.push({ type: 'del', oldLine: oldNo++, newLine: null, text: line.slice(1), commentable: true });
    } else {
      lines.push({ type: 'context', oldLine: oldNo++, newLine: newNo++, text: line.slice(1), commentable: true });
    }
  }
  return lines;
}

/**
 * Merges parsed patch lines into the full head file, so unchanged lines between and around hunks show too.
 * Hunk headers are dropped. Gap lines are context, numbered from the counters the previous hunk left off at.
 */
export function expandToFullFile(patchLines: readonly DiffLine[], headText: string): DiffLine[] {
  const head = headText.split('\n');
  if (head.at(-1) === '') {
    head.pop();
  }

  const lines: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  const fillUntil = (newLineExclusive: number) => {
    while (newNo < newLineExclusive && newNo <= head.length) {
      lines.push({ type: 'context', oldLine: oldNo++, newLine: newNo, text: head[newNo - 1], commentable: false });
      newNo++;
    }
  };

  for (const line of patchLines) {
    if (line.type === 'hunk') {
      const m = HUNK_HEADER.exec(line.text);
      if (m) {
        fillUntil(Number(m[2]));
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      continue;
    }
    lines.push(line);
    if (line.oldLine !== null) {
      oldNo = line.oldLine + 1;
    }
    if (line.newLine !== null) {
      newNo = line.newLine + 1;
    }
  }
  fillUntil(head.length + 1);
  return lines;
}

export function toPrFileChange(file: GitHubPullRequestFile): PrFileChange {
  return {
    path: file.filename,
    previousPath: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    lines: file.patch ? parsePatch(file.patch) : [],
    hasPatch: !!file.patch,
  };
}

export function toPrFiles(files: GitHubPullRequestFile[]): PrFiles {
  return { files: files.map(toPrFileChange), truncated: files.length >= GITHUB_MAX_FILES };
}
