import { app } from "../app.js";
import { pool } from "../config/database.js";
import { resetDatabase, seedUsers } from "./helpers/db.js";
import request from "supertest";

const ADMIN_TOKEN = "admin-token";
const USER_TOKEN = "user-token";

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

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterAll(() => pool.end());

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
    expect(res.body.message).toBe("Please provide a valid food name");
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
    expect(res.body.message).toBe("calories_per_100g must be between 0 and 9999.99");
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
      "calories_per_100g must be a number",
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

  it("Return 403 on unauthorized users adding food", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Not permitted. Admin only");
  });

  it("Returns 400 when the image key is outside the catalog folder", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "myfood/2/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid image key");
  });

  it("Returns 401 when the token cannot be verified", async () => {
    const res = await request(app)
      .post("/api/foods/add")
      .set("Authorization", "Bearer fake_token")
      .send({ name: "White Rice" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("POST /api/foods/upload-url", () => {
  it("Returns 403 for non-admin users", async () => {
    const res = await request(app)
      .post("/api/foods/upload-url")
      .set("Authorization", `Bearer ${USER_TOKEN}`)
      .send({ contentType: "image/png" });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Not permitted. Admin only");
  });

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

describe("GET /api/foods/all", () => {
  it("Returns 200 status and foods on successful query ", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=1");

    expect(res.statusCode).toBe(200);
    expect(res.body.foods).toEqual([
      {
        id: 1,
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image_url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`,
      },
    ]);
  });

  it("Returns 200 status and empty array on successful query if no food in database", async () => {
    const res = await request(app).get("/api/foods/all?currentPage=1");

    expect(res.statusCode).toBe(200);
    expect(res.body.foods).toEqual([]);
  });

  it("Returns 400 on invalid page number", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=abf");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid page number");
  });

  it("Returns 400 on empty current page query", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid page number");
  });

  it("Returns 400 on page number zero provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=0");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid page number");
  });

  it("Returns 400 on decimal page number provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=1.5");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid page number");
  });

  it("Returns 400 on negative page number provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/all?currentPage=-2");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid page number");
  });
});

describe("GET /api/foods/:foodId", () => {
  it("Returns 200 on successful query by food id", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/1");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      name: "White Rice",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`,
    });
  });

  it("Returns 404 on non found food data by id", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/2");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Food not found");
  });

  it("Returns 400 on non-numeric food id provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/abf");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Returns 400 on decimal food id provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/1.5");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Returns 400 on negative food id provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/-4");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Returns 400 on number zero as food id provided", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app).get("/api/foods/0");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });
});

describe("PATCH /api/foods/update/:foodId", () => {
  it("Return 400 if foodId is not valid", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/abc")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz Blanco",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 400 if foodId is decimal", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/1.5")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz Blanco",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 400 if foodId is negative", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/-1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz Blanco",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 404 if food doesn't exist", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/2")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz Blanco",
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Food not found");
  });

  it("Return 400 if new food name is invalid", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz$# Blanco",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please provide a valid food name");
  });

  it("Return 400 if macros are not numbers", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        calories_per_100g: "abf",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "calories_per_100g must be a number",
    );
  });

  it("Return 400 if macros are negative", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        calories_per_100g: -10,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("calories_per_100g must be between 0 and 9999.99");
  });

  it("Return 200 on successful food data update", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .patch("/api/foods/update/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "Arroz Blanco",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Food data updated");

    const isFoodUpdated = await pool.query(
      `SELECT name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, image_url FROM foods WHERE id=1`,
    );

    expect(isFoodUpdated.rows[0]).toEqual({
      name: "Arroz Blanco",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      fat_per_100g: 0.3,
      carbs_per_100g: 28.2,
      fiber_per_100g: 0.4,
      image_url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg`,
    });
  });
});

describe("DELETE /api/foods/delete/:foodId", () => {
  it("Return 400 if foodId is not valid", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .delete("/api/foods/delete/abc")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 400 if foodId is decimal", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .delete("/api/foods/delete/1.5")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 400 if foodId is negative", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .delete("/api/foods/delete/-15")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid food id");
  });

  it("Return 404 if food doesn't exist", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .delete("/api/foods/delete/2")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Food not found");
  });

  it("Return 200 upon successfully deleting food by id", async () => {
    await request(app)
      .post("/api/foods/add")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`)
      .send({
        name: "White Rice",
        calories_per_100g: 130,
        protein_per_100g: 2.7,
        fat_per_100g: 0.3,
        carbs_per_100g: 28.2,
        fiber_per_100g: 0.4,
        image: "foods/7b1d01c2-ebc5-4067-a78c-448c1225e188.jpg",
      });

    const res = await request(app)
      .delete("/api/foods/delete/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Food deleted successfully");

    // Soft delete: the row stays for meal history but leaves the catalog
    const row = await pool.query("SELECT deleted_at FROM foods WHERE id=1");
    expect(row.rows[0].deleted_at).not.toBeNull();

    const afterDelete = await request(app).get("/api/foods/1");
    expect(afterDelete.statusCode).toBe(404);

    const deleteAgain = await request(app)
      .delete("/api/foods/delete/1")
      .set("Authorization", `Bearer ${ADMIN_TOKEN}`);
    expect(deleteAgain.statusCode).toBe(404);
  });
});
