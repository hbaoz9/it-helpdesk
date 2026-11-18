import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AI_PROVIDER, type AiProvider } from './ai.types.js';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 10;

@Injectable()
export class AiService {
  private readonly requests = new Map<string, number[]>();

  constructor(@Inject(AI_PROVIDER) private readonly provider: AiProvider) {}

  assist(userId: string, description: string) {
    const now = Date.now();
    const recent = (this.requests.get(userId) ?? []).filter((time) => now - time < WINDOW_MS);
    if (recent.length >= MAX_REQUESTS) {
      throw new HttpException('Bạn đã dùng hết 10 lượt AI trong một giờ. Vui lòng thử lại sau.', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.requests.set(userId, [...recent, now]);
    // Evict expired users to keep the in-process limiter bounded over time.
    if (this.requests.size > 1000) {
      for (const [id, times] of this.requests) {
        if (times.every((time) => now - time >= WINDOW_MS)) this.requests.delete(id);
      }
    }
    return this.provider.assist(description);
  }
}
