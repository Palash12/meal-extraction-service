import { ZodError } from "zod";

import { validateRequestInput } from "../../src/pipeline/inputGuardrails/validateRequest";

describe("validateRequestInput", () => {
  it("returns a valid parsed request", () => {
    expect(
      validateRequestInput({
        image_url: "https://example.com/meal.jpg",
        user_note: "Lunch bowl",
        request_id: "req_1",
      }),
    ).toEqual({
      image_url: "https://example.com/meal.jpg",
      user_note: "Lunch bowl",
      request_id: "req_1",
    });
  });

  it("rejects invalid request bodies", () => {
    expect(() =>
      validateRequestInput({
        image_url: "not-a-url",
      }),
    ).toThrow(ZodError);
  });
});
