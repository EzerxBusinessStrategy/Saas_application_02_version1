export async function closeWorker(worker: { close(): Promise<void> }): Promise<void> {
  await worker.close();
}
