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

export class InvalidSelectionError extends Data.TaggedError("InvalidSelectionError")<{
  readonly message: string;
}> {}

export class SelectionTooLargeError extends Data.TaggedError("SelectionTooLargeError")<{
  readonly message: string;
  readonly estimatedTokens: number;
  readonly budget: number;
}> {}

export class ContextOverflowError extends Data.TaggedError("ContextOverflowError")<{
  readonly message: string;
  readonly estimatedTokens: number;
  readonly contextWindow: number;
}> {}

export class ProviderAuthError extends Data.TaggedError("ProviderAuthError")<{
  readonly message: string;
  readonly provider: string;
  readonly status: number;
}> {}

export class ProviderRateLimitError extends Data.TaggedError("ProviderRateLimitError")<{
  readonly message: string;
  readonly provider: string;
  readonly retryAfterMs: number;
}> {}

export class ProviderUnavailableError extends Data.TaggedError("ProviderUnavailableError")<{
  readonly message: string;
  readonly provider: string;
  readonly status?: number;
  readonly cause?: unknown;
}> {}

export class ProviderTimeoutError extends Data.TaggedError("ProviderTimeoutError")<{
  readonly message: string;
  readonly phase: "connect" | "idle" | "total";
  readonly afterMs: number;
}> {}

export class ContentFilterError extends Data.TaggedError("ContentFilterError")<{
  readonly message: string;
}> {}

export class RefusalError extends Data.TaggedError("RefusalError")<{
  readonly message: string;
}> {}

export class EmptyResponseError extends Data.TaggedError("EmptyResponseError")<{
  readonly message: string;
  readonly finishReason: string | null;
}> {}

export class AbortedError extends Data.TaggedError("AbortedError")<{
  readonly message: string;
  readonly reason?: string;
}> {}

export class OutputValidationError extends Data.TaggedError("OutputValidationError")<{
  readonly message: string;
  readonly issues: string;
  readonly raw: string;
}> {}

export class StructuredOutputUnsupportedError extends Data.TaggedError(
  "StructuredOutputUnsupportedError",
)<{
  readonly message: string;
  readonly provider: string;
}> {}

export type GenerationError =
  | GenerationValidationError
  | ConfigError
  | ChatBusyError
  | LeaseLostError
  | StaleTargetError
  | InvalidSelectionError
  | SelectionTooLargeError
  | ContextOverflowError
  | ProviderAuthError
  | ProviderRateLimitError
  | ProviderUnavailableError
  | ProviderTimeoutError
  | ContentFilterError
  | RefusalError
  | EmptyResponseError
  | AbortedError
  | OutputValidationError
  | StructuredOutputUnsupportedError;

const HTTP_STATUS: Record<GenerationError["_tag"], number> = {
  GenerationValidationError: 400,
  ConfigError: 422,
  ChatBusyError: 409,
  LeaseLostError: 409,
  StaleTargetError: 409,
  InvalidSelectionError: 400,
  SelectionTooLargeError: 413,
  ContextOverflowError: 413,
  ProviderAuthError: 502,
  ProviderRateLimitError: 429,
  ProviderUnavailableError: 503,
  ProviderTimeoutError: 504,
  ContentFilterError: 422,
  RefusalError: 422,
  EmptyResponseError: 502,
  AbortedError: 499,
  OutputValidationError: 422,
  StructuredOutputUnsupportedError: 502,
};

const ERROR_CODES: Record<GenerationError["_tag"], string> = {
  GenerationValidationError: "invalid_request",
  ConfigError: "config",
  ChatBusyError: "busy",
  LeaseLostError: "lease_lost",
  StaleTargetError: "stale_target",
  InvalidSelectionError: "invalid_selection",
  SelectionTooLargeError: "selection_too_large",
  ContextOverflowError: "context_overflow",
  ProviderAuthError: "provider_auth",
  ProviderRateLimitError: "rate_limited",
  ProviderUnavailableError: "provider_unavailable",
  ProviderTimeoutError: "timeout",
  ContentFilterError: "content_filter",
  RefusalError: "refusal",
  EmptyResponseError: "empty_response",
  AbortedError: "aborted",
  OutputValidationError: "invalid_output",
  StructuredOutputUnsupportedError: "structured_unsupported",
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
