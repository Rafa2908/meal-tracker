import { app } from "../app.js";
import { pool } from "../config/database.js";
import request from "supertest";

const ADMIN_TOKEN = "admin-token";
const USER_TOKEN = "user-token";
const FAKE_TOKEN = "fake_token";

// eslint-disable-next-line no-undef
jest.mock("aws-jwt-verify", () => ({
  CognitoJwtVerifier: {
    create: () => ({
      verify: async (token) => {
        if (token === ADMIN_TOKEN) {
          return { sub: "admin-sub", "cognito:groups": ["Admins"] };
        }
        if (token === USER_TOKEN) {
          return { sub: "user-sub" };
        }
        throw new Error("Invalid token");
      },
    }),
  },
}));

// eslint-disable-next-line no-undef
beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      cognito_id VARCHAR(255) NOT NULL UNIQUE,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(50) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS my_foods(
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name VARCHAR(255) NOT NULL,
        calories_per_100g NUMERIC(6,2) NOT NULL,
        protein_per_100g NUMERIC(6,2) NOT NULL,
        fat_per_100g NUMERIC(6,2) NOT NULL,
        carbs_per_100g NUMERIC(6,2) NOT NULL,
        fiber_per_100g NUMERIC(6,2) NOT NULL,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) 
    `);

  await pool.query(`
    INSERT INTO users(cognito_id, first_name, last_name, email)
    VALUES
      ('admin-sub', 'Admin', 'Test', 'admin@test.com'),
      ('user-sub', 'User', 'Test', 'user@test.com')
  `);
});

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE my_foods RESTART IDENTITY CASCADE");
});

// eslint-disable-next-line no-undef
afterAll(async () => {
  await pool.query("DROP TABLE IF EXISTS foods CASCADE");
  await pool.query("DROP TABLE IF EXISTS users CASCADE");
  await pool.end();
});

describe("POST /api/myfoods/add", () => {
  it("Returns 500 token cannot be verified", async () => {
    // eslint-disable-next-line no-undef
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${FAKE_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
      });

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Internal server error");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("Returns 400 if food data not provided", async () => {
    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "",
        calories_per_100g: null,
        protein_per_100g: null,
        fat_per_100g: null,
        carbs_per_100g: null,
        fiber_per_100g: null,
        image: "",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("No food data provided");
  });

  it("Returns 400 if macro values are not numerical", async () => {
    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: "null",
        protein_per_100g: "null",
        fat_per_100g: "null",
        carbs_per_100g: "null",
        fiber_per_100g: "null",
        image: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Please provide a numerical value for macros",
    );
  });

  it("Returns 400 if invalid food name provided", async () => {
    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "White$ R%ice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please provide a valid food name");
  });

  it("Returns 400 if macro values are negative", async () => {
    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: -12,
        protein_per_100g: -12,
        fat_per_100g: -12,
        carbs_per_100g: -12,
        fiber_per_100g: -12,
        image: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Macro values cannot be negative");
  });

  it("Returns 201 upon success food entry", async () => {
    const res = await request(app)
      .post("/api/myfoods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
      });

    const foodEntry = await pool.query(
      `
      SELECT name, calories_per_100g, protein_per_100g, fat_per_100g,
      carbs_per_100g, fiber_per_100g, image_url
      FROM my_foods
      WHERE user_id=$1 AND id=$2
      `,
      [2, 1],
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("New food added");
    expect(foodEntry.rowCount).toBe(1);
    expect(foodEntry.rows[0]).toEqual({
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: "myfood/test756-f248-41aa-8438-b8bad8179fd9.jpg",
    });
  });
});
