import type { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
interface ContextMessage { role: 'user'; content: { type: 'text'; text: string }[] }
export interface HostAdapter {
  readonly canSendContext: boolean;
  readonly canDeepLink: boolean;
  getDeepLink(): { url: string } | undefined;
  sendContext(message: ContextMessage): Promise<void>;
}
export function createHostAdapter(app: App): HostAdapter {
  let extensions: OpenAIExtensions | undefined;
  const supported = (): boolean => Object.keys(app.getHostCapabilities()?.experimental || {}).some((key) => key.startsWith('openai/')) || Object.keys(app.getHostContext() || {}).some((key) => key.startsWith('openai/'));
  const openai = (): OpenAIExtensions | undefined => {
    if (!extensions && supported()) extensions = new OpenAIExtensions(app);
    return extensions;
  };
  return {
    get canSendContext(): boolean { return Boolean(openai()?.message || app.getHostCapabilities()?.message); },
    get canDeepLink(): boolean { return Boolean(openai()); },
    getDeepLink(): { url: string } | undefined { return openai()?.deepLink.getCurrent(); },
    async sendContext(message: ContextMessage): Promise<void> {
      const api = openai()?.message;
      if (api) { await api.send({ ...message }); return; }
      if (!app.getHostCapabilities()?.message) throw new Error('Diese Anwendung unterstützt die Kontextübergabe aus MCP-Apps nicht.');
      const result = await app.sendMessage(message);
      if (result.isError) throw new Error('Die Anwendung hat die Kontextübergabe abgelehnt.');
    },
  };
}
