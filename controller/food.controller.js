import { pool } from "../config/database.js";
import { buildFoodImageUrl } from "../config/s3.js";
import {
  parseId,
  parsePage,
  validateFoodPayload,
} from "../utils/validation.js";
import {
  assertKeyUnderPrefix,
  CATALOG_PREFIX,
  newImageKey,
  presignUpload,
} from "../utils/images.js";

const PAGE_SIZE = 12;

export const getFoodImageUploadUrl = async (req, res, next) => {
  try {
    const { contentType } = req.body ?? {};
    const key = newImageKey(CATALOG_PREFIX, contentType);
    const uploadUrl = await presignUpload(key, contentType);

    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    next(error);
  }
};

export const insertFood = async (req, res, next) => {
  try {
    const food = validateFoodPayload(req.body);
    const imageKey = assertKeyUnderPrefix(req.body.image, CATALOG_PREFIX);

    const { rows } = await pool.query(
      `
      INSERT INTO foods (name, calories_per_100g, protein_per_100g, fat_per_100g,
                         carbs_per_100g, fiber_per_100g, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        food.name,
        food.calories_per_100g,
        food.protein_per_100g,
        food.fat_per_100g,
        food.carbs_per_100g,
        food.fiber_per_100g,
        buildFoodImageUrl(imageKey),
      ],
    );

    return res.status(201).json({ message: "New food added", id: rows[0].id });
  } catch (error) {
    next(error);
  }
};

export const getAllFoods = async (req, res, next) => {
  try {
    const page = parsePage(req.query.currentPage);

    const { rows } = await pool.query(
      `
      SELECT id, name, calories_per_100g, protein_per_100g, fat_per_100g,
             carbs_per_100g, fiber_per_100g, image_url
      FROM foods
      WHERE deleted_at IS NULL
      ORDER BY id
      LIMIT $1 OFFSET $2
      `,
      [PAGE_SIZE, PAGE_SIZE * (page - 1)],
    );

    return res.status(200).json({ foods: rows, page, pageSize: PAGE_SIZE });
  } catch (error) {
    next(error);
  }
};

export const getFoodById = async (req, res, next) => {
  try {
    const foodId = parseId(req.params.foodId, "food id");

    const { rows } = await pool.query(
      `
      SELECT name, calories_per_100g, protein_per_100g, fat_per_100g,
             carbs_per_100g, fiber_per_100g, image_url
      FROM foods
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [foodId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.status(200).json(rows[0]);
  } catch (error) {
    next(error);
  }
};

// One UPDATE with COALESCE: each column takes the new value if one was sent,
// otherwise keeps its current value. Atomic on its own, no pool client to leak.
export const updateFoodById = async (req, res, next) => {
  try {
    const foodId = parseId(req.params.foodId, "food id");
    const fields = validateFoodPayload(req.body, { partial: true });
    const imageUrl =
      req.body.image === undefined
        ? null
        : buildFoodImageUrl(
            assertKeyUnderPrefix(req.body.image, CATALOG_PREFIX),
          );

    const { rowCount } = await pool.query(
      `
      UPDATE foods SET
        name              = COALESCE($2, name),
        calories_per_100g = COALESCE($3, calories_per_100g),
        protein_per_100g  = COALESCE($4, protein_per_100g),
        fat_per_100g      = COALESCE($5, fat_per_100g),
        carbs_per_100g    = COALESCE($6, carbs_per_100g),
        fiber_per_100g    = COALESCE($7, fiber_per_100g),
        image_url         = COALESCE($8, image_url)
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [
        foodId,
        fields.name ?? null,
        fields.calories_per_100g ?? null,
        fields.protein_per_100g ?? null,
        fields.fat_per_100g ?? null,
        fields.carbs_per_100g ?? null,
        fields.fiber_per_100g ?? null,
        imageUrl,
      ],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.status(200).json({ message: "Food data updated" });
  } catch (error) {
    next(error);
  }
};

// Soft delete: logged meals keep referencing the row, the catalog stops showing it.
export const deleteFoodById = async (req, res, next) => {
  try {
    const foodId = parseId(req.params.foodId, "food id");

    const { rowCount } = await pool.query(
      `
      UPDATE foods SET deleted_at = now()
      WHERE id = $1 AND deleted_at IS NULL
      `,
      [foodId],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.status(200).json({ message: "Food deleted successfully" });
  } catch (error) {
    next(error);
  }
};
