import type { PrFileChange } from '@pr-manager/contracts';

export interface FileTreeNode {
  /** Display name. Folder chains with a single sub-folder are joined, e.g. `src/app`. */
  name: string;
  /** Full path; unique across the tree. */
  path: string;
  /** Set for files, null for folders. */
  file: PrFileChange | null;
  children: FileTreeNode[];
}

/** Builds the folder tree of changed files: folders first, then files, each alphabetical. */
export function buildFileTree(files: readonly PrFileChange[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', file: null, children: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    parts.slice(0, -1).forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let folder = node.children.find((c) => !c.file && c.path === path);
      if (!folder) {
        folder = { name: part, path, file: null, children: [] };
        node.children.push(folder);
      }
      node = folder;
    });
    node.children.push({ name: parts.at(-1) ?? file.path, path: file.path, file, children: [] });
  }
  return root.children.map(compress).sort(byFolderThenName);
}

/** Files in tree order, so the diff list matches the tree. */
export function filesInTreeOrder(tree: readonly FileTreeNode[]): PrFileChange[] {
  return tree.flatMap((n) => (n.file ? [n.file] : filesInTreeOrder(n.children)));
}

/** Splits a path into the file name and its folder (empty for root files). */
export function splitPath(path: string): { name: string; folder: string } {
  const i = path.lastIndexOf('/');
  return i < 0 ? { name: path, folder: '' } : { name: path.slice(i + 1), folder: path.slice(0, i) };
}

function compress(node: FileTreeNode): FileTreeNode {
  if (node.file) {
    return node;
  }
  let current = node;
  let name = node.name;
  while (current.children.length === 1 && !current.children[0].file) {
    current = current.children[0];
    name = `${name}/${current.name}`;
  }
  return { name, path: current.path, file: null, children: current.children.map(compress).sort(byFolderThenName) };
}

function byFolderThenName(a: FileTreeNode, b: FileTreeNode): number {
  if (!a.file !== !b.file) {
    return a.file ? 1 : -1;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Short text icons by extension, ADO-style (M↓ for Markdown, C# for C#). */
const FILE_BADGES: Record<string, string> = {
  md: 'M↓',
  cs: 'C#',
  ts: 'TS',
  js: 'JS',
  json: '{}',
  html: '<>',
  scss: '#',
  css: '#',
  yml: 'Y',
  yaml: 'Y',
  csproj: 'C#',
  sql: 'DB',
};

export function fileBadge(path: string): string | null {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return path.includes('.') ? (FILE_BADGES[ext] ?? null) : null;
}
