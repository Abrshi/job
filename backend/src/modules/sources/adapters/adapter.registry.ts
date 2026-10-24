import { SourceAdapter } from './source-adapter.interface';
import { afriworkAdapter } from './afriwork.adapter';
import { hahuJobsAdapter } from './hahujobs.adapter';
import { AppError } from '../../../middleware/error-handler';

export class AdapterRegistry {
  private adapters = new Map<string, SourceAdapter>();

  constructor() {
    this.register(afriworkAdapter);
    this.register(hahuJobsAdapter);
  }

  register(adapter: SourceAdapter): void {
    this.adapters.set(adapter.slug.toLowerCase(), adapter);
  }

  get(slug: string): SourceAdapter {
    const adapter = this.adapters.get(slug.toLowerCase());
    if (!adapter) {
      throw AppError.notFound(`No adapter registered for source slug '${slug}'`, 'SOURCE_ADAPTER_NOT_FOUND');
    }
    return adapter;
  }

  has(slug: string): boolean {
    return this.adapters.has(slug.toLowerCase());
  }

  list(): SourceAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export const adapterRegistry = new AdapterRegistry();
