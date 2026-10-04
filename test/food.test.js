import { app } from "../app.js";
import { pool } from "../config/database.js";
import request from "supertest";

const ADMIN_TOKEN = "admin-token";
const USER_TOKEN = "user-token";

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
    INSERT INTO users(cognito_id, first_name, last_name, email)
    VALUES
      ('admin-sub', 'Admin', 'Test', 'admin@test.com'),
      ('user-sub', 'User', 'Test', 'user@test.com')
  `);
});

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE foods RESTART IDENTITY CASCADE");
});

// eslint-disable-next-line no-undef
afterAll(async () => {
  await pool.query("DROP TABLE IF EXISTS foods CASCADE");
  await pool.query("DROP TABLE IF EXISTS users CASCADE");
  await pool.end();
});

describe("POST /api/foods/add", () => {
  it("Returns 201 status upon successfully adding food to database", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Chicken Breast",
        calories_per_100g: 165,
        protein_per_100g: 31,
        fat_per_100g: 3.6,
        carbs_per_100g: 0,
        fiber_per_100g: 0,
        image: "foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const getFood = await pool.query(`
            SELECT id,
              name,  
              calories_per_100g,
              protein_per_100g,
              fat_per_100g,
              carbs_per_100g,
              fiber_per_100g,
              image_url
            FROM foods
      `);

    const food = getFood.rows[0];

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("New food added");
    expect(food).toEqual({
      id: 1,
      name: "Chicken Breast",
      calories_per_100g: 165,
      protein_per_100g: 31,
      fat_per_100g: 3.6,
      carbs_per_100g: 0,
      fiber_per_100g: 0,
      image_url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/foods/6b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`,
    });
  });

  it("Returns 400 status on empty food data entry", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
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

  it("Returns 400 status on negative macros data", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
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
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
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
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
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

  it("Return 401 on unathorized users adding food", async () => {
    await request(app).post("/api/auth/login").send({
      email: "ikicks.sti@gmail.com",
      password: "Test123$",
    });

    const res = await request(app).post("/api/foods/add").send({
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("POST /api/foods/upload-url", () => {
  it("Returns 400 on unsupported image type", async () => {
    const res = await request(app)
      .post("/api/foods/upload-url")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        contentType: "image/avif",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Unsupported image type");
  });

  it("Returns 200 on successful request", async () => {
    const res = await request(app)
      .post("/api/foods/upload-url")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        contentType: "image/png",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.key).toMatch(
      /^foods\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
    );
    expect(res.body.uploadUrl).toEqual(
      expect.stringContaining(
        `${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`,
      ),
    );
  });
});
