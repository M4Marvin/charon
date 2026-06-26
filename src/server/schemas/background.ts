import { type } from "arktype";

export const GetBackgroundInput = type({ id: "string > 0" });
export const DeleteBackgroundInput = type({ id: "string > 0" });
export const UploadBackgroundInput = type({
  name: "string > 0",
  fileBase64: "string > 0",
});
