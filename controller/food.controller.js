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
