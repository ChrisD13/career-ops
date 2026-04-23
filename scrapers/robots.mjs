import robotsParser from 'robots-parser';
import { setTimeout as sleep } from 'timers/promises';

export const USER_AGENT = 'JobEngineBot/1.0 (+https://github.com/santifer/career-ops)';
const robotsCache = new Map();

export async function checkAllowed(url) {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    let body = '';
    try {
      const res = await fetch(robotsUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': USER_AGENT },
      });
      body = res.ok ? await res.text() : '';
    } catch { body = ''; }
    robotsCache.set(origin, robotsParser(robotsUrl, body));
  }
  const parser = robotsCache.get(origin);
  return {
    allowed: parser.isAllowed(url, USER_AGENT) ?? true,
    crawlDelay: parser.getCrawlDelay(USER_AGENT) ?? null,
  };
}

export async function randomDelay(min = 500, max = 2000) {
  const ms = min + Math.floor(Math.random() * (max - min));
  await sleep(ms);
}
