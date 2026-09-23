import { type } from "arktype";
import { MAX_IMAGE_BASE64_LENGTH } from "@/server/image-limits";

export const UploadPersonaIconInput = type({
  id: "string > 0",
  fileBase64: `string > 0 & string <= ${MAX_IMAGE_BASE64_LENGTH}`,
});
