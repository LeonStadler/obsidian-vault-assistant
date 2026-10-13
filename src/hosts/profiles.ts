import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export type HostProfile = 'openai' | 'cursor' | 'claude-desktop' | 'claude-code' | 'generic';
const candidate = process.env.VAULT_MCP_HOST || 'openai';
if (!['openai','cursor','claude-desktop','claude-code','generic'].includes(candidate)) throw new Error(`Unknown Vault host profile: ${candidate}`);
export const hostProfile = candidate as HostProfile;
export function hostTool(tool: Tool): Tool {
  if (hostProfile === 'openai') return tool;
  return { ...tool, _meta: Object.fromEntries(Object.entries(tool._meta || {}).filter(([key]) => !key.startsWith('openai/'))) };
}
export function hostCapabilities(): { extensions?: Record<string, unknown>; experimental?: Record<string, unknown> } {
  if (hostProfile !== 'openai') return {};
  const settings = { 'openai/settings': { readTool: 'settings.read', updateTool: 'settings.update' } };
  return { extensions: settings, experimental: settings };
}
export function resourceMetadata(): Record<string, unknown> {
  return { ui: { prefersBorder: true }, ...(hostProfile === 'openai' ? { 'openai/ui': { availableDisplayModes: ['inline'], preferredDisplayMode: 'inline' } } : {}) };
}
