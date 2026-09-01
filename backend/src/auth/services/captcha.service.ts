import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

interface SiteVerifyResponse {
  success: boolean;
}

@Injectable()
export class CaptchaService {
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }

    const secret = this.configService.getOrThrow<string>(
      'RECAPTCHA_SECRET_KEY',
    );

    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });

    const data = (await response.json()) as SiteVerifyResponse;
    return data.success === true;
  }
}
