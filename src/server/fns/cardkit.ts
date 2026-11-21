import { createServerFn } from "@tanstack/react-start";
import { type } from "arktype";
import { cardDetail, listCards, renderAndReport } from "@/server/cardkit";
import { getSession } from "@/server/session";

const nameInput = type({ name: "string" });

function validateName(input: unknown): { name: string } {
  const result = nameInput(input);
  if (result instanceof type.errors) throw new Error("Invalid card name");
  return result;
}

export const listCardsFn = createServerFn({ method: "GET" }).handler(async () => {
  await getSession();
  return listCards();
});

export const cardDetailFn = createServerFn({ method: "GET" })
  .validator(validateName)
  .handler(async ({ data }) => {
    await getSession();
    return cardDetail(data.name);
  });

export const renderCardFn = createServerFn({ method: "POST" })
  .validator(validateName)
  .handler(async ({ data }) => {
    await getSession();
    return renderAndReport(data.name);
  });
