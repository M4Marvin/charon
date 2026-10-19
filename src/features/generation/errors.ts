import { Data } from "effect";

export class GenerationValidationError extends Data.TaggedError("GenerationValidationError")<{
  readonly message: string;
  readonly field?: string;
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

export class ChatBusyError extends Data.TaggedError("ChatBusyError")<{
  readonly message: string;
  readonly chatId: string;
  readonly activeJobId: string;
}> {}

export class LeaseLostError extends Data.TaggedError("LeaseLostError")<{
  readonly message: string;
  readonly jobId: string;
}> {}

export class StaleTargetError extends Data.TaggedError("StaleTargetError")<{
  readonly message: string;
  readonly expectedRev: number;
  readonly actualRev: number;
}> {}

export class ContextOverflowError extends Data.TaggedError("ContextOverflowError")<{
  readonly message: string;
  readonly estimatedTokens: number;
  readonly contextWindow: number;
}> {}

export class EmptyResponseError extends Data.TaggedError("EmptyResponseError")<{
  readonly message: string;
  readonly finishReason: string | null;
}> {}

export type GenerationError =
  | GenerationValidationError
  | ConfigError
  | ChatBusyError
  | LeaseLostError
  | StaleTargetError
  | ContextOverflowError
  | EmptyResponseError;

const HTTP_STATUS: Record<GenerationError["_tag"], number> = {
  GenerationValidationError: 400,
  ConfigError: 422,
  ChatBusyError: 409,
  LeaseLostError: 409,
  StaleTargetError: 409,
  ContextOverflowError: 413,
  EmptyResponseError: 502,
};

const ERROR_CODES: Record<GenerationError["_tag"], string> = {
  GenerationValidationError: "invalid_request",
  ConfigError: "config",
  ChatBusyError: "busy",
  LeaseLostError: "lease_lost",
  StaleTargetError: "stale_target",
  ContextOverflowError: "context_overflow",
  EmptyResponseError: "empty_response",
};

export function isGenerationError(value: unknown): value is GenerationError {
  if (typeof value !== "object" || value === null || !("_tag" in value)) return false;
  const tag = (value as { _tag: unknown })._tag;
  return typeof tag === "string" && Object.hasOwn(HTTP_STATUS, tag);
}

export function httpStatusFor(error: GenerationError): number {
  return HTTP_STATUS[error._tag];
}

export function codeFor(error: GenerationError): string {
  return ERROR_CODES[error._tag];
}

export function toErrorBody(error: GenerationError): { code: string; message: string } {
  return { code: codeFor(error), message: error.message };
}
