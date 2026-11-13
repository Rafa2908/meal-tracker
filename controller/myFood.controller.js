import { pool } from "../config/database.js";
import {
  nameValidator,
  NotNumberSanitizer,
} from "../utils/utils.inputValidator.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { s3Client } from "../config/s3.js";

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const getMyFoodImageUploadUrl = async (req, res, next) => {
  const { contentType } = req.body;

  try {
    const extension = ALLOWED_TYPES[contentType];

    if (!extension) {
      return res.status(400).json({ message: "Unsupported image type" });
    }

    const key = `myfood/${randomUUID()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    next(error);
  }
};

export const insertMyFood = async (req, res, next) => {
  const { id } = req.user;

  const {
    name,
    calories_per_100g,
    protein_per_100g,
    fat_per_100g,
    carbs_per_100g,
    fiber_per_100g,
    image,
  } = req.body;

  const macroValues = [
    calories_per_100g,
    protein_per_100g,
    fat_per_100g,
    carbs_per_100g,
    fiber_per_100g,
  ];

  try {
    if (
      !name ||
      calories_per_100g == null ||
      protein_per_100g == null ||
      fat_per_100g == null ||
      carbs_per_100g == null ||
      fiber_per_100g == null ||
      !image
    ) {
      return res.status(400).json({ message: "No food data provided" });
    }

    if (NotNumberSanitizer(macroValues)) {
      return res
        .status(400)
        .json({ message: "Please provide a numerical value for macros" });
    }

    if (!nameValidator(name)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid food name" });
    }

    if (
      calories_per_100g < 0 ||
      protein_per_100g < 0 ||
      fat_per_100g < 0 ||
      carbs_per_100g < 0 ||
      fiber_per_100g < 0
    ) {
      return res
        .status(400)
        .json({ message: "Macro values cannot be negative" });
    }

    const food = await pool.query(
      `
      INSERT INTO my_foods(name, user_id, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, image_url)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        name,
        id,
        calories_per_100g,
        protein_per_100g,
        fat_per_100g,
        carbs_per_100g,
        fiber_per_100g,
        image,
      ],
    );

    if (food.rowCount === 0) {
      return res.status(400).json({ message: "Error adding food to database" });
    }

    return res.status(201).json({ message: "New food added" });
  } catch (error) {
    next(error);
  }
};

export const getMyFoodById = async (req, res, next) => {
  const { foodId } = req.params;
  const { id: userId } = req.user;

  try {
    if (isNaN(foodId)) {
      return res.status(400).json({ message: "Invalid food id" });
    }

    if (foodId % 1 !== 0) {
      return res.status(400).json({ message: "Invalid food id" });
    }

    if (foodId < 1) {
      return res.status(400).json({ message: "Invalid food id" });
    }

    const food = await pool.query(
      `
      SELECT name, calories_per_100g,
      protein_per_100g, fat_per_100g,
      carbs_per_100g, fiber_per_100g,
      image_url
      FROM my_foods
      WHERE id=$1 AND user_id=$2
      `,
      [foodId, userId],
    );

    if (food.rowCount === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    const row = food.rows[0];

    const image_url = row.image_url
      ? await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: row.image_url,
          }),
          { expiresIn: 300 },
        )
      : null;

    return res.status(200).json({ ...row, image_url });
  } catch (error) {
    next(error);
  }
};

export const getAllMyFoods = async (req, res, next) => {
  const { currentPage } = req.query;
  const { id: userId } = req.user;

  try {
    if (!currentPage) {
      return res.status(400).json({ message: "No page number provided" });
    }

    if (isNaN(currentPage)) {
      return res.status(400).json({ message: "Invalid page number" });
    }

    if (Number(currentPage) < 1) {
      return res
        .status(400)
        .json({ message: "Page number cannot be 0 or negative" });
    }

    if (currentPage % 1 !== 0) {
      return res.status(400).json({ message: "Page cannot be a decimal" });
    }

    const foods = await pool.query(
      `
      SELECT id, name,
      calories_per_100g,
      protein_per_100g,
      fat_per_100g, carbs_per_100g,
      fiber_per_100g, image_url
      FROM my_foods
      WHERE user_id=$1
      LIMIT 12 OFFSET (12 * ($2 -1))
      `,
      [userId, currentPage],
    );

    if (foods.rowCount === 0) {
      return res.status(200).json({ foods: [] });
    }

    const foodsWithImages = await Promise.all(
      foods.rows.map(async (row) => {
        if (!row.image_url) {
          return row;
        }

        const image_url = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: row.image_url,
          }),
          { expiresIn: 300 },
        );

        return { ...row, image_url };
      }),
    );

    return res.status(200).json({ foods: foodsWithImages });
  } catch (error) {
    next(error);
  }
};

export const updateMyFoodById = async (req, res, next) => {
  const { id: userId } = req.user;
  const { foodId } = req.params;
  const {
    name,
    calories_per_100g,
    protein_per_100g,
    fat_per_100g,
    carbs_per_100g,
    fiber_per_100g,
    image,
  } = req.body;

  const client = await pool.connect();

  let inTransaction = false;

  try {
    if (isNaN(foodId)) {
      return res.status(400).json({ message: "Invalid food id provided" });
    }

    if (foodId % 1 !== 0) {
      return res.status(400).json({ message: "Invalid food id provided" });
    }

    if (foodId <= 0) {
      return res.status(400).json({ message: "Invalid food id provided" });
    }

    await client.query("BEGIN");
    inTransaction = true;

    const foodExist = await client.query(
      `
      SELECT 
        name,
        calories_per_100g,
        protein_per_100g,
        fat_per_100g,
        carbs_per_100g,
        fiber_per_100g,
        image_url
      FROM my_foods
      WHERE user_id=$1 AND id=$2
      `,
      [userId, foodId],
    );

    if (foodExist.rowCount === 0) {
      await client.query(`ROLLBACK`);
      return res.status(404).json({ message: "Food couldn't be found" });
    }

    const myFood = foodExist.rows[0];

    const mergeFoodData = {
      name: name ?? myFood.name,
      calories_per_100g: calories_per_100g ?? myFood.calories_per_100g,
      protein_per_100g: protein_per_100g ?? myFood.protein_per_100g,
      fat_per_100g: fat_per_100g ?? myFood.fat_per_100g,
      carbs_per_100g: carbs_per_100g ?? myFood.carbs_per_100g,
      fiber_per_100g: fiber_per_100g ?? myFood.fiber_per_100g,
      image_url: image ?? myFood.image_url,
    };

    const macroValues = [
      mergeFoodData.calories_per_100g,
      mergeFoodData.protein_per_100g,
      mergeFoodData.fat_per_100g,
      mergeFoodData.carbs_per_100g,
      mergeFoodData.fiber_per_100g,
    ];

    if (!nameValidator(mergeFoodData.name)) {
      await client.query(`ROLLBACK`);
      return res
        .status(400)
        .json({ message: "Please provide a valid food name" });
    }

    if (NotNumberSanitizer(macroValues)) {
      await client.query(`ROLLBACK`);
      return res
        .status(400)
        .json({ message: "Macros must be a numerical value" });
    }

    if (macroValues.some((macro) => macro < 0)) {
      await client.query(`ROLLBACK`);
      return res.status(400).json({ message: "Macros cannot be negative" });
    }

    const updateMyFood = await client.query(
      `
      UPDATE my_foods
      SET 
        name=$1, 
        calories_per_100g=$2,
        protein_per_100g=$3,
        fat_per_100g=$4,
        carbs_per_100g=$5,
        fiber_per_100g=$6,
        image_url=$7
      WHERE user_id=$8 AND id=$9
      RETURNING id
      `,
      [
        mergeFoodData.name,
        mergeFoodData.calories_per_100g,
        mergeFoodData.protein_per_100g,
        mergeFoodData.fat_per_100g,
        mergeFoodData.carbs_per_100g,
        mergeFoodData.fiber_per_100g,
        mergeFoodData.image_url,
        userId,
        foodId,
      ],
    );

    if (updateMyFood.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Food couldn't be updated" });
    }

    await client.query("COMMIT");
    inTransaction = false;

    return res.status(200).json({ message: "Food updated" });
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    next(error);
  } finally {
    client.release();
  }
};
