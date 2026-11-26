import { config as loadDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
loadDotenv({ path: resolve(serverRoot, '.env'), quiet: true });

export const env = {
  githubToken: process.env['GITHUB_TOKEN'] ?? '',
  port: Number(process.env['PORT'] ?? 3000),
  reposConfigPath: resolve(serverRoot, 'repos.config.json'),
  adoOrg: process.env['ADO_ORG'] || 'nbsdev',
  adoProject: process.env['ADO_PROJECT'] || 'Services',
  // Falls back to the PAT already used by the ADO MCP server.
  adoPat: process.env['ADO_PAT'] || process.env['PERSONAL_ACCESS_TOKEN'] || '',
};
