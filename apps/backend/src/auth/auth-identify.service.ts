import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthIdentifyService {
  async identifyEmail(_email: string): Promise<{ method: "password" }> {
    // Password authentication must not disclose whether an account exists.
    return { method: "password" };
  }
}
