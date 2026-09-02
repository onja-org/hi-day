import { Logger } from '@nestjs/common';

const logger = new Logger('Analytics');

export function recordAnalyticsEvent(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  logger.log(JSON.stringify({ event, ...properties }));
}
