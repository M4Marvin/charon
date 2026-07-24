import { type } from "arktype";

export const UploadPersonaIconInput = type({
  id: "string > 0",
  fileBase64: "string > 0",
});
