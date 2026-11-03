import { Controller, Get, Inject } from '@nestjs/common';
import { ENTITLEMENTS, type Entitlements } from './entitlements';

export interface PublicConfig {
  billingEnabled: boolean;
}

/**
 * The only unguarded endpoint: the browser reads it before anyone logs in,
 * so one built frontend can serve either shape. Nothing secret may be added
 * to the response.
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
