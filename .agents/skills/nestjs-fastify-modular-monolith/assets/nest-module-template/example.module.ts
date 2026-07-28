import { Module } from "@nestjs/common";

import { ExampleController } from "./example.controller";
import { ExamplePolicy } from "./example.policy";
import { ExampleRepository } from "./example.repository";
import { ExampleService } from "./example.service";

@Module({
  controllers: [ExampleController],
  providers: [ExampleService, ExamplePolicy, ExampleRepository],
  exports: [ExampleService],
})
export class ExampleModule {}
