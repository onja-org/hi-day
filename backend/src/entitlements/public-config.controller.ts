import { Controller, Get, Inject } from '@nestjs/common';
import { ENTITLEMENTS, type Entitlements } from './entitlements';

/** What the browser is told about this installation. */
export interface PublicConfig {
  /**
   * Whether this installation bills anybody. The frontend hides every
   * billing surface when it is false.
   */
  billingEnabled: boolean;
}

/**
 * The one thing the browser must know before it can draw the app
 * correctly, and the only endpoint on the backend with no guard on it.
 *
 * Public by necessity: it is read before anyone has logged in, by a
 * frontend that is a static build and therefore cannot be compiled with
 * this baked in. Answering it at runtime is also what lets one built image
 * serve both shapes — the same container runs self-hosted or Cloud
 * depending on an environment variable, with no rebuild.
 *
 * **Nothing secret may ever go in this response.** It is readable by
 * anybody who can reach the server, logged in or not. It carries a single
 * boolean that is already obvious from the UI, and it must stay that way:
 * no keys, no provider ids, no counts, no customer data.
 */
@Controller('config')
export class PublicConfigController {
  constructor(
    @Inject(ENTITLEMENTS) private readonly entitlements: Entitlements,
  ) {}

  @Get()
  get(): PublicConfig {
    return { billingEnabled: this.entitlements.billingEnabled };
  }
}
