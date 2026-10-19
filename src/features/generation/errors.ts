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

export function httpStatusFor(error: GenerationError): number {
  switch (error._tag) {
    case "GenerationValidationError":
    case "InvalidSelectionError":
      return 400;
    case "ConfigError":
      return 422;
    case "ChatBusyError":
    case "StaleTargetError":
      return 409;
    case "SelectionTooLargeError":
    case "ContextOverflowError":
      return 413;
    case "ProviderAuthError":
      return 502;
    case "ProviderRateLimitError":
      return 429;
    case "ProviderUnavailableError":
      return 503;
    case "ProviderTimeoutError":
      return 504;
    case "ContentFilterError":
    case "RefusalError":
    case "OutputValidationError":
      return 422;
    case "EmptyResponseError":
      return 502;
    case "StructuredOutputUnsupportedError":
      return 502;
    case "AbortedError":
      return 499;
    case "LeaseLostError":
      return 409;
  }
}

export function codeFor(error: GenerationError): string {
  switch (error._tag) {
    case "GenerationValidationError":
      return "invalid_request";
    case "ConfigError":
      return "config";
    case "ChatBusyError":
      return "busy";
    case "LeaseLostError":
      return "lease_lost";
    case "StaleTargetError":
      return "stale_target";
    case "InvalidSelectionError":
      return "invalid_selection";
    case "SelectionTooLargeError":
      return "selection_too_large";
    case "ContextOverflowError":
      return "context_overflow";
    case "ProviderAuthError":
      return "provider_auth";
    case "ProviderRateLimitError":
      return "rate_limited";
    case "ProviderUnavailableError":
      return "provider_unavailable";
    case "ProviderTimeoutError":
      return "timeout";
    case "ContentFilterError":
      return "content_filter";
    case "RefusalError":
      return "refusal";
    case "EmptyResponseError":
      return "empty_response";
    case "AbortedError":
      return "aborted";
    case "OutputValidationError":
      return "invalid_output";
    case "StructuredOutputUnsupportedError":
      return "structured_unsupported";
  }
}

export function toErrorBody(error: GenerationError): { code: string; message: string } {
  return { code: codeFor(error), message: error.message };
}
