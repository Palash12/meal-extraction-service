process.env.OPENAI_API_KEY = "test-key";

import request from "supertest";

import { createApp } from "../../src/app";

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      responses: {
        create: jest.fn().mockResolvedValue({
          output_text: JSON.stringify({
            dish_candidates: ["burrito bowl"],
            visible_components: ["rice", "beans"],
            portion_estimate: {
              size: "medium",
              confidence: "medium",
              notes: "One bowl-sized meal",
            },
            observed: ["Rice is visible"],
            assumed: [],
            unknown: [],
            needs_user_confirmation: false,
            clarifying_question: null,
          }),
        }),
      },
    })),
  };
});

describe("POST /v1/meals/extract", () => {
  it("returns structured meal extraction data", async () => {
    const app = createApp();

    const response = await request(app).post("/v1/meals/extract").send({
      image_url: "https://example.com/meal.jpg",
      user_note: "Lunch bowl",
      request_id: "req_1",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dish_candidates: ["burrito bowl"],
      visible_components: ["rice", "beans"],
      portion_estimate: {
        size: "medium",
        confidence: "medium",
        notes: "One bowl-sized meal",
      },
      observed: ["Rice is visible"],
      assumed: [],
      unknown: [],
      needs_user_confirmation: false,
      clarifying_question: null,
    });
    expect(response.headers["x-request-id"]).toBe("req_1");
  });

  it("rejects invalid request bodies", async () => {
    const app = createApp();

    const response = await request(app).post("/v1/meals/extract").send({
      image_url: "not-a-url",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
