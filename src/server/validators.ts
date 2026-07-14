import { type } from "arktype";

const IdInput = type({ id: "string > 0" });

export function validateId(data: unknown): { id: string } {
  const result = IdInput(data);
  if (result instanceof type.errors) throw new Error("Invalid id");
  return result;
}
