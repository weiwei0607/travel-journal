export async function retry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delay?: number; onRetry?: (err: unknown, attempt: number) => void } = {}
): Promise<T> {
  const { retries = 3, delay = 500, onRetry } = options;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        onRetry?.(err, attempt + 1);
        await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}
