import { DexAdapter } from './adapter.js';

export class DexAdapterRegistry {
  private readonly adapters = new Map<string, DexAdapter>();

  public register(adapter: DexAdapter): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
  }

  public getAdapter(id: string): DexAdapter | undefined {
    return this.adapters.get(id.toLowerCase());
  }

  public getAllAdapters(): DexAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getEnabledAdapters(): DexAdapter[] {
    return this.getAllAdapters().filter((a) => a.enabled);
  }
}
