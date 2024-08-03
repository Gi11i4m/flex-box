export async function executePromisesInOrder<T>(
  promises: Promise<T[]>[],
): Promise<T[]> {
  let acc: T[] = [];
  for (let promise of promises) {
    acc = [...acc, ...(await promise)];
  }
  return acc;
}
