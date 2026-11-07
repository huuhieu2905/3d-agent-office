import type { OfficeLayout } from '../../shared/domain';
import { officeLayoutSchema } from '../../shared/schemas';
import { JsonStore } from '../storage/json-store';
import { defaultLayout } from './default-layout';

export class LayoutStore {
  private store: JsonStore<OfficeLayout>;
  private cache: OfficeLayout | null = null;

  constructor(dataDir: string) {
    this.store = new JsonStore<OfficeLayout>(dataDir, {
      file: 'layout.json',
      schema: officeLayoutSchema as never,
      defaults: defaultLayout,
    });
  }

  async get(): Promise<OfficeLayout> {
    if (!this.cache) this.cache = await this.store.read();
    return this.cache;
  }

  async save(layout: OfficeLayout): Promise<void> {
    await this.store.write(layout);
    this.cache = layout;
  }
}
