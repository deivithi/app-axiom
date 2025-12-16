/**
 * Fetch wrapper with automatic retry on failure
 * Implements exponential backoff for resilient API calls
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

const defaultOptions: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...defaultOptions, ...options };
  
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${Math.round(delay)}ms...`);
      
      options.onRetry?.(attempt + 1, lastError);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Wrapper for Supabase function calls with retry
 */
export async function supabaseFunctionWithRetry<T>(
  supabase: any,
  functionName: string,
  body: any,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await fetchWithRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke(functionName, { body });
        if (error) throw error;
        return data as T;
      },
      options
    );
    return { data: result, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Hook-friendly wrapper that returns loading and error states
 */
export function createRetryableRequest<TInput, TOutput>(
  requestFn: (input: TInput) => Promise<TOutput>,
  options: RetryOptions = {}
) {
  return async (input: TInput): Promise<{ data: TOutput | null; error: Error | null }> => {
    try {
      const data = await fetchWithRetry(() => requestFn(input), options);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  };
}
