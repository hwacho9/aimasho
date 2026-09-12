/** Share concurrent reads only; never retain Places results or cache mutations. */
export function createInFlightRequests<T>() {
  const requests = new Map<string, Promise<T>>();
  return (key: string, read: () => Promise<T>): Promise<T> => {
    const existing = requests.get(key);
    if (existing) return existing;
    const pending = Promise.resolve().then(read).finally(() => {
      if (requests.get(key) === pending) requests.delete(key);
    });
    requests.set(key, pending);
    return pending;
  };
}
