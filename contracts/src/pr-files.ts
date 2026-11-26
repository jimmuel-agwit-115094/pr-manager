/** GitHub's file status on a PR diff. */
export type FileChangeStatus = 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';

/** `hunk` is the `@@ -a,b +c,d @@` header that starts each block of changes. */
export type DiffLineType = 'context' | 'add' | 'del' | 'hunk';

export interface DiffLine {
  type: DiffLineType;
  /** Line number in the base file; null for added lines and hunk headers. */
  oldLine: number | null;
  /** Line number in the head file; null for deleted lines and hunk headers. */
  newLine: number | null;
  /** Line text without the leading +/-/space marker. */
  text: string;
  /** True for lines inside a diff hunk: GitHub only accepts review comments on those. */
  commentable: boolean;
}

export interface PrFileChange {
  path: string;
  /** Set for renames and copies. */
  previousPath: string | null;
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  /** Parsed diff. Empty with `hasPatch: false` when GitHub sends no patch (binary or too large). */
  lines: DiffLine[];
  hasPatch: boolean;
}

export interface PrFiles {
  files: PrFileChange[];
  /** True when the PR has more files than were fetched (GitHub caps the list at 3000). */
  truncated: boolean;
}

/** One file as shown when it's selected in the Files Changed tab. */
export interface PrFileView {
  path: string;
  /**
   * The whole head file with deleted lines merged in, when `isFullFile`.
   * Otherwise only the diff hunks (file content couldn't be fetched, or the file was deleted).
   */
  lines: DiffLine[];
  isFullFile: boolean;
}
