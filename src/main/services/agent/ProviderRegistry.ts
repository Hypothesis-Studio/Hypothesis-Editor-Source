/**
 * Provider Registry - Manages AI provider adapters.
 * Handles registration, configuration, health checks, and model discovery.
 */
import type {
  AIProviderConfig,
  AIModelConfig,
  AIProviderStatus,
} from '../../../shared/types/agent';
import { AgentError } from '../../../shared/types/agent';
import type { ProviderAdapter, ChatCompletionRequest, ChatCompletionResponse } from './ProviderAdapter';
import { OpenAICompatibleProvider } from './providers/OpenAICompatibleProvider';
import { logger } from '../../utils/logger';
import type { AppStore } from '../AppStore';

const log = logger.scope('ProviderRegistry');

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();
  private statuses = new Map<string, AIProviderStatus>();
  private appStore: AppStore;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  async initialize(): Promise<void> {
    const providers = this.getStoredProviders();
    for (const config of providers) {
      if (config.enabled) {
        this.registerAdapter(config);
      }
    }
    this.startHealthChecks();
    log.info(`Initialized with ${this.adapters.size} providers`);
  }

  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private getStoredProviders(): AIProviderConfig[] {
    return (this.appStore.get('agent.providers') as unknown as AIProviderConfig[]) ?? [];
  }

  private saveProviders(providers: AIProviderConfig[]): void {
    this.appStore.set('agent.providers', providers);
  }

  registerAdapter(config: AIProviderConfig): void {
    const adapter = this.createAdapter(config);
    this.adapters.set(config.id, adapter);
    this.statuses.set(config.id, {
      providerId: config.id,
      connected: false,
      lastChecked: 0,
      modelsAvailable: config.models?.length ?? 0,
    });
    log.info(`Registered provider: ${config.name} (${config.type})`);
  }

  private createAdapter(config: AIProviderConfig): ProviderAdapter {
    switch (config.type) {
      case 'openrouter':
      case 'ninerouter':
      case 'openai-compatible':
      case 'custom':
        return new OpenAICompatibleProvider(config) as unknown as ProviderAdapter;
      default:
        throw new AgentError(`Unknown provider type: ${config.type}`, 'INVALID_CONFIG', 'config');
    }
  }

  async addProvider(config: AIProviderConfig): Promise<AIProviderConfig> {
    const existing = this.getStoredProviders();
    if (existing.some(p => p.id === config.id)) {
      throw new AgentError(`Provider ${config.id} already exists`, 'DUPLICATE', 'config');
    }
    const providers = [...existing, config];
    this.saveProviders(providers);
    if (config.enabled) {
      this.registerAdapter(config);
    }
    return config;
  }

  async updateProvider(id: string, updates: Partial<AIProviderConfig>): Promise<AIProviderConfig> {
    const providers = this.getStoredProviders();
    const index = providers.findIndex(p => p.id === id);
    if (index === -1) throw new AgentError(`Provider ${id} not found`, 'NOT_FOUND', 'config');

    const updated = { ...providers[index], ...updates, id };
    providers[index] = updated;
    this.saveProviders(providers);

    // Re-register adapter
    this.adapters.delete(id);
    if (updated.enabled) {
      this.registerAdapter(updated);
    }

    return updated;
  }

  async removeProvider(id: string): Promise<void> {
    const providers = this.getStoredProviders().filter(p => p.id !== id);
    this.saveProviders(providers);
    this.adapters.delete(id);
    this.statuses.delete(id);
    log.info(`Removed provider: ${id}`);
  }

  getAdapter(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new AgentError(`Provider ${providerId} not found or disabled`, 'NOT_FOUND', 'config', providerId);
    }
    return adapter;
  }

  listProviders(): AIProviderConfig[] {
    return this.getStoredProviders();
  }

  getEnabledProviders(): AIProviderConfig[] {
    return this.getStoredProviders().filter(p => p.enabled);
  }

  getStatus(providerId: string): AIProviderStatus | undefined {
    return this.statuses.get(providerId);
  }

  getAllStatuses(): AIProviderStatus[] {
    return Array.from(this.statuses.values());
  }

  async testProvider(providerId: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const adapter = this.getAdapter(providerId);
    const result = await adapter.testConnection();
    const status: AIProviderStatus = {
      providerId,
      connected: result.success,
      lastError: result.error,
      lastChecked: Date.now(),
      latencyMs: result.latencyMs,
      modelsAvailable: this.getStoredProviders().find(p => p.id === providerId)?.models?.length ?? 0,
    };
    this.statuses.set(providerId, status);
    return result;
  }

  async fetchModels(providerId: string): Promise<AIModelConfig[]> {
    const adapter = this.getAdapter(providerId);
    const models = await adapter.listModels();
    // Update stored provider with fetched models
    const providers = this.getStoredProviders();
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      provider.models = models;
      this.saveProviders(providers);
      const status = this.statuses.get(providerId);
      if (status) status.modelsAvailable = models.length;
    }
    return models;
  }

  async chat(providerId: string, request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const adapter = this.getAdapter(providerId);
    return adapter.chat(request);
  }

  async *chatStream(providerId: string, request: ChatCompletionRequest) {
    const adapter = this.getAdapter(providerId);
    yield* adapter.chatStream(request);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [id, adapter] of this.adapters) {
        try {
          const result = await adapter.testConnection();
          this.statuses.set(id, {
            providerId: id,
            connected: result.success,
            lastError: result.error,
            lastChecked: Date.now(),
            latencyMs: result.latencyMs,
            modelsAvailable: this.getStoredProviders().find(p => p.id === id)?.models?.length ?? 0,
          });
        } catch {
          // Silent fail for health checks
        }
      }
    }, 300000); // Every 5 minutes
  }
}
