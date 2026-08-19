import { Logger } from 'pino';

export interface AlertNotification {
  readonly level: 'INFO' | 'WARN' | 'CRITICAL';
  readonly title: string;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: Date;
}

export class AlertingService {
  private readonly logger: Logger | undefined;
  private readonly webhookUrl: string | undefined;

  constructor(webhookUrl?: string, logger?: Logger) {
    this.webhookUrl = webhookUrl;
    this.logger = logger;
  }

  /**
   * Dispatch real-time operational alerts to Telegram / Discord / Prometheus
   */
  public async sendAlert(alert: AlertNotification): Promise<boolean> {
    this.logger?.info({ alert }, `📢 [${alert.level}] ${alert.title}: ${alert.message}`);

    if (!this.webhookUrl) {
      return true;
    }

    try {
      const payload = {
        embeds: [
          {
            title: `[${alert.level}] ${alert.title}`,
            description: alert.message,
            color: alert.level === 'CRITICAL' ? 0xff0000 : alert.level === 'WARN' ? 0xffa500 : 0x00ff00,
            timestamp: alert.timestamp.toISOString(),
            fields: alert.metadata
              ? Object.entries(alert.metadata).map(([k, v]) => ({
                  name: k,
                  value: String(v),
                  inline: true,
                }))
              : [],
          },
        ],
      };

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return true;
    } catch (err: unknown) {
      this.logger?.warn({ err }, 'Failed to dispatch webhook alert');
      return false;
    }
  }
}
