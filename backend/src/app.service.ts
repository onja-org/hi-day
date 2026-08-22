import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): { status: string; message: string } {
    return { status: 'ok', message: 'Backend is running' };
  }
}
