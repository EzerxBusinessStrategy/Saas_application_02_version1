export type ExampleJobPayload = {
  tenantId: string;
  resourceId: string;
};

export async function enqueueExampleJob(payload: ExampleJobPayload): Promise<void> {
  void payload;
}
