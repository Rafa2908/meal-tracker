import { app } from "../app.js";
import { pool } from "../config/database.js";
import request from "supertest";

// eslint-disable-next-line no-undef
beforeAll(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS foods(
        id SERIAL PRIMARY KEY,
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
});

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE foods RESTART IDENTITY CASCADE");
});

// eslint-disable-next-line no-undef
afterAll(async () => {
  await pool.query("DROP TABLE IF EXISTS foods CASCADE");
  await pool.end();
});

describe("POST /api/foods/add", () => {
  it("Returns 201 status upon successfully adding food to database", async () => {
    const res = await request(app).post("/api/foods/add").send({
      name: "Chicken Breast",
      calories_per_100g: 165,
      protein_per_100g: 31,
      fat_per_100g: 3.6,
      carbs_per_100g: 0,
      fiber_per_100g: 0,
      image: "foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("New food added");
  });

  it("Returns 400 status on empty food data entry", async () => {
    const res = await request(app).post("/api/foods/add").send({
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

  it("Returns 400 status on negative macros data", async () => {
    const res = await request(app).post("/api/foods/add").send({
      name: "Chicken Breast",
      calories_per_100g: -10,
      protein_per_100g: -10,
      fat_per_100g: -10,
      carbs_per_100g: -10,
      fiber_per_100g: -10,
      image: "foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Macro values cannot be negative");
  });

  it("Returns 400 status on non numeric macros data", async () => {
    const res = await request(app).post("/api/foods/add").send({
      name: "Chicken Breast",
      calories_per_100g: "abc",
      protein_per_100g: "abc",
      fat_per_100g: "abc",
      carbs_per_100g: "abc",
      fiber_per_100g: "abc",
      image: "foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Please provide a numerical value for macros",
    );
  });

  it("Returns 400 status on invalid food name format", async () => {
    const res = await request(app).post("/api/foods/add").send({
      name: "$Chicken) -Breast",
      calories_per_100g: 10,
      protein_per_100g: 10,
      fat_per_100g: 10,
      carbs_per_100g: 10,
      fiber_per_100g: 10,
      image: "foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please provide a valid food name");
  });
});
