import { app } from "../app.js";
import { pool } from "../config/database.js";
import { resetDatabase, seedUsers, USER_IDS } from "./helpers/db.js";
import request from "supertest";

const USER_TOKEN = "user-token";
const OTHER_TOKEN = "other-token";
const FAKE_TOKEN = "fake_token";

jest.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: () => ({
      verify: async (token) => {
        if (token === "admin-token") {
          return { sub: "admin-sub", "cognito:groups": ["Admins"] };
        }
        if (token === "user-token") return { sub: "user-sub" };
        if (token === "other-token") return { sub: "other-sub" };
        throw new Error("Invalid token");
      },
    }),
  },
}));

// Keys must live under the uploading user's own prefix: myfood/<userId>/<uuid>.<ext>
const USER_IMAGE = `myfood/${USER_IDS.user}/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`;
const OTHER_IMAGE = `myfood/${USER_IDS.other}/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`;

const WHITE_RICE = {
  name: "White Rice",
  calories_per_100g: 130,
  protein_per_100g: 2.7,
  fat_per_100g: 0.3,
  carbs_per_100g: 28.2,
  fiber_per_100g: 0.4,
  image: USER_IMAGE,
};

const addFood = (token, body) =>
  request(app)
    .post("/api/myfoods/add")
    .set("Authorization", `Bearer ${token}`)
    .send(body);

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterAll(() => pool.end());

describe("POST /api/myfoods/add", () => {
  it("Returns 401 when the token cannot be verified", async () => {
    const res = await addFood(FAKE_TOKEN, WHITE_RICE);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("Returns 400 if food data not provided", async () => {
    const res = await addFood(USER_TOKEN, {
      name: "",
      calories_per_100g: null,
      protein_per_100g: null,
      fat_per_100g: null,
      carbs_per_100g: null,
      fiber_per_100g: null,
      image: "",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please provide a valid food name");
  });

  it("Returns 400 if macro values are not numerical", async () => {
    const res = await addFood(USER_TOKEN, {
      ...WHITE_RICE,
      calories_per_100g: "null",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("calories_per_100g must be a number");
  });

  it("Returns 400 if invalid food name provided", async () => {
    const res = await addFood(USER_TOKEN, {
      ...WHITE_RICE,
      name: "White$ R%ice",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please provide a valid food name");
  });

  it("Returns 400 if macro values are negative", async () => {
    const res = await addFood(USER_TOKEN, {
      ...WHITE_RICE,
      calories_per_100g: -12,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "calories_per_100g must be between 0 and 9999.99",
    );
  });

  it("Returns 400 if the image key is under another user's prefix", async () => {
    const res = await addFood(USER_TOKEN, { ...WHITE_RICE, image: OTHER_IMAGE });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid image key");

    const rows = await pool.query("SELECT id FROM my_foods");
    expect(rows.rowCount).toBe(0);
  });

  it("Returns 201 upon success food entry", async () => {
    const res = await addFood(USER_TOKEN, WHITE_RICE);

    const foodEntry = await pool.query(
      `
      SELECT name, calories_per_100g, protein_per_100g, fat_per_100g,
      carbs_per_100g, fiber_per_100g, image_url
      FROM my_foods
      WHERE user_id=$1 AND id=$2
      `,
      [USER_IDS.user, 1],
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ message: "New food added", id: 1 });
    expect(foodEntry.rowCount).toBe(1);
    expect(foodEntry.rows[0]).toEqual({
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: USER_IMAGE,
    });
  });
});

describe("POST /api/myfoods/upload-url", () => {
  it("Returns a key under the requesting user's prefix", async () => {
    const res = await request(app)
      .post("/api/myfoods/upload-url")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ contentType: "image/webp" });

    expect(res.statusCode).toBe(200);
    expect(res.body.key).toMatch(
      new RegExp(
        `^myfood/${USER_IDS.user}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.webp$`,
      ),
    );
  });

  it("Returns 400 on unsupported image type", async () => {
    const res = await request(app)
      .post("/api/myfoods/upload-url")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ contentType: "image/avif" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Unsupported image type");
  });
});

describe("GET /api/myfoods/:foodId", () => {
  it("Returns the food with a presigned image URL to its owner", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .get("/api/myfoods/1")
      .set("Authorization", `Bearer ${USER_TOKEN}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: 1,
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: expect.stringContaining(USER_IMAGE),
    });
    expect(res.body.image_url).toContain("X-Amz-Signature=");
  });

  it("Returns 404 when the food belongs to another user", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .get("/api/myfoods/1")
      .set("Authorization", `Bearer ${OTHER_TOKEN}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Food not found");
  });

  it("Returns 400 on an id that isn't a plain integer", async () => {
    const res = await request(app)
      .get("/api/myfoods/0x10")
      .set("Authorization", `Bearer ${USER_TOKEN}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });
});

describe("GET /api/myfoods/all", () => {
  it("Returns only the requesting user's foods", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);
    await addFood(OTHER_TOKEN, {
      ...WHITE_RICE,
      name: "Brown Rice",
      image: OTHER_IMAGE,
    });

    const res = await request(app)
      .get("/api/myfoods/all?currentPage=1")
      .set("Authorization", `Bearer ${USER_TOKEN}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.foods.map((food) => food.name)).toEqual(["White Rice"]);
  });
});

describe("PATCH /api/myfoods/update/:foodId", () => {
  it("Returns 404 when the food belongs to another user", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .patch("/api/myfoods/update/1")
      .set("Authorization", `Bearer ${OTHER_TOKEN}`)
      .send({ protein_per_100g: 30 });

    expect(res.statusCode).toBe(404);

    const row = await pool.query("SELECT protein_per_100g FROM my_foods");
    expect(row.rows[0].protein_per_100g).toBe(2.7);
  });

  it("Updates only the fields sent", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .patch("/api/myfoods/update/1")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ protein_per_100g: 30 });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Food updated");

    const row = await pool.query(
      `
      SELECT name, calories_per_100g, protein_per_100g, fat_per_100g,
      carbs_per_100g, fiber_per_100g, image_url
      FROM my_foods WHERE id=1
      `,
    );

    expect(row.rows[0]).toEqual({
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 30,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: USER_IMAGE,
    });
  });

  it("Rejects an image key under another user's prefix", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .patch("/api/myfoods/update/1")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ image: OTHER_IMAGE });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid image key");
  });

  it("Rejects null instead of silently keeping the old value", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .patch("/api/myfoods/update/1")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ protein_per_100g: null });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("protein_per_100g must be a number");
  });

  it("Returns 400 when no fields are sent", async () => {
    await addFood(USER_TOKEN, WHITE_RICE);

    const res = await request(app)
      .patch("/api/myfoods/update/1")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("No fields to update");
  });
});
