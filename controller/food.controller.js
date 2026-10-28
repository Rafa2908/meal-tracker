import { pool } from "../config/database.js";
import {
  nameValidator,
  NotNumberSanitizer,
} from "../utils/utils.inputValidator.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { buildFoodImageUrl, s3Client } from "../config/s3.js";

const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const getFoodImageUploadUrl = async (req, res, next) => {
  const { contentType } = req.body;

  try {
    const extension = ALLOWED_TYPES[contentType];

    if (!extension) {
      return res.status(400).json({ message: "Unsupported image type" });
    }

    const key = `foods/${randomUUID()}.${extension}`;

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

export const insertFood = async (req, res, next) => {
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

    const s3_url = buildFoodImageUrl(image);

    const food = await pool.query(
      `
      INSERT INTO foods(name, calories_per_100g, protein_per_100g, fat_per_100g, carbs_per_100g, fiber_per_100g, image_url)
      VALUES($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        name,
        calories_per_100g,
        protein_per_100g,
        fat_per_100g,
        carbs_per_100g,
        fiber_per_100g,
        s3_url,
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

export const getAllFoods = async (req, res, next) => {
  const { currentPage } = req.query;
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
      FROM foods
      LIMIT 12 OFFSET (12 * ($1 -1))
      `,
      [currentPage],
    );

    return res
      .status(200)
      .json({ foods: foods.rowCount === 0 ? [] : foods.rows });
  } catch (error) {
    next(error);
  }
};

export const getFoodById = async (req, res, next) => {
  const { foodId } = req.params;

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
      FROM foods
      WHERE id=$1
      `,
      [foodId],
    );

    if (food.rowCount === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.status(200).json(food.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateFoodById = async (req, res, next) => {
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
        name, calories_per_100g,
        protein_per_100g, fat_per_100g,
        carbs_per_100g, fiber_per_100g, image_url
      FROM foods
      WHERE id=$1
      `,
      [foodId],
    );

    if (foodExist.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No food data found" });
    }

    const food = foodExist.rows[0];

    const uploaded_image_url = image ? buildFoodImageUrl(image) : undefined;

    const mergedData = {
      name: name ?? food.name,
      calories_per_100g: calories_per_100g ?? food.calories_per_100g,
      protein_per_100g: protein_per_100g ?? food.protein_per_100g,
      fat_per_100g: fat_per_100g ?? food.fat_per_100g,
      carbs_per_100g: carbs_per_100g ?? food.carbs_per_100g,
      fiber_per_100g: fiber_per_100g ?? food.fiber_per_100g,
      image_url: uploaded_image_url ?? food.image_url,
    };

    const mergedMacros = [
      mergedData.calories_per_100g,
      mergedData.protein_per_100g,
      mergedData.fat_per_100g,
      mergedData.carbs_per_100g,
      mergedData.fiber_per_100g,
    ];

    if (!nameValidator(mergedData.name)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid food name provided" });
    }

    if (NotNumberSanitizer(mergedMacros)) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Please provide a numerical value for macros" });
    }

    if (mergedMacros.some((macro) => macro < 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Macros cannot be negative" });
    }

    const updateFood = await client.query(
      `
      UPDATE foods
      SET name=$1, calories_per_100g=$2, protein_per_100g=$3,
      fat_per_100g=$4, carbs_per_100g=$5, fiber_per_100g=$6,
      image_url=$7
      WHERE id=$8
      RETURNING id
      `,
      [
        mergedData.name,
        mergedData.calories_per_100g,
        mergedData.protein_per_100g,
        mergedData.fat_per_100g,
        mergedData.carbs_per_100g,
        mergedData.fiber_per_100g,
        mergedData.image_url,
        foodId,
      ],
    );

    if (updateFood.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Food couldn't be updated" });
    }

    await client.query("COMMIT");

    inTransaction = false;

    return res.status(200).json({ message: "Food data updated" });
  } catch (error) {
    if (inTransaction) {
      await client.query("ROLLBACK");
    }
    next(error);
  } finally {
    client.release();
  }
};

// export const deleteFoodById = async (req, res, next) => {};
