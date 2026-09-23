import { type } from "arktype";
import { MAX_IMAGE_BASE64_LENGTH } from "@/server/image-limits";

export const GetBackgroundInput = type({ id: "string > 0" });
export const DeleteBackgroundInput = type({ id: "string > 0" });
export const UploadBackgroundInput = type({
  name: "string > 0",
  fileBase64: `string > 0 & string <= ${MAX_IMAGE_BASE64_LENGTH}`,
});
