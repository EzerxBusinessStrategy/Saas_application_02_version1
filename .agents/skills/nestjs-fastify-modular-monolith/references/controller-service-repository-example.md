# Controller-Service-Repository Example

This is a shape example only.

```ts
@Controller("/api/v1/tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(@CurrentActor() actor: TrustedActor, @Body() dto: CreateTaskRequestDto) {
    return this.tasks.createTask(actor, dto);
  }
}
```

```ts
export class TasksService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly policy: TaskPolicy,
  ) {}

  async createTask(actor: TrustedActor, dto: CreateTaskRequestDto) {
    this.policy.assertCanCreate(actor, dto);
    return this.tasks.insert(actor.tenantId, dto);
  }
}
```

```ts
export interface TaskRepository {
  insert(tenantId: string, dto: CreateTaskRequestDto): Promise<TaskResponseDto>;
}
```

Keep validation and authorization at the boundary and service/policy layer. Do not let browser-supplied tenant or actor fields become trusted context.
