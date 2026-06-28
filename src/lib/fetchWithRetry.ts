/**
 * A robust fetch wrapper that retries on transient network errors or 5xx server issues.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  delayMs = 1500
): Promise<Response> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        return res;
      }
      // If server returned a 5xx error or 429 rate limit, retry
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`Server returned status ${res.status}`);
      }
      // For standard 4xx (e.g. 400 Bad Request, 404), return it without retrying
      return res;
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        throw err;
      }
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.warn(`Fetch to ${url} failed (attempt ${attempt}/${retries}). Retrying in ${waitTime}ms... Error:`, err);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  throw new Error(`Fetch to ${url} failed after ${retries} attempts.`);
}
