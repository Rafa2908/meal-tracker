import { pool } from "../config/database.js";
import {
  parseId,
  parsePage,
  validateFoodPayload,
} from "../utils/validation.js";
import {
  assertKeyUnderPrefix,
  myFoodPrefix,
  newImageKey,
  presignRead,
  presignUpload,
} from "../utils/images.js";

const PAGE_SIZE = 12;

// The key includes the user's id, so a stored key can be checked against
// the requester (see assertKeyUnderPrefix on insert/update).
export const getMyFoodImageUploadUrl = async (req, res, next) => {
  try {
    const { contentType } = req.body ?? {};
    const key = newImageKey(myFoodPrefix(req.user.id), contentType);
    const uploadUrl = await presignUpload(key, contentType);

    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    next(error);
  }
};

export const insertMyFood = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const food = validateFoodPayload(req.body);
    const imageKey = assertKeyUnderPrefix(req.body.image, myFoodPrefix(userId));

    const { rows } = await pool.query(
      `
      INSERT INTO my_foods (user_id, name, calories_per_100g, protein_per_100g,
                            fat_per_100g, carbs_per_100g, fiber_per_100g, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        userId,
        food.name,
        food.calories_per_100g,
        food.protein_per_100g,
        food.fat_per_100g,
        food.carbs_per_100g,
        food.fiber_per_100g,
        imageKey,
      ],
    );

    return res.status(201).json({ message: "New food added", id: rows[0].id });
  } catch (error) {
    next(error);
  }
};

export const getMyFoodById = async (req, res, next) => {
  try {
    const foodId = parseId(req.params.foodId, "food id");

    const { rows } = await pool.query(
      `
      SELECT id, name, calories_per_100g, protein_per_100g, fat_per_100g,
             carbs_per_100g, fiber_per_100g, image_url
      FROM my_foods
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `,
      [foodId, req.user.id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    const row = rows[0];
    const image_url = row.image_url ? await presignRead(row.image_url) : null;

    return res.status(200).json({ ...row, image_url });
  } catch (error) {
    next(error);
  }
};

export const getAllMyFoods = async (req, res, next) => {
  try {
    const page = parsePage(req.query.currentPage);

    const { rows } = await pool.query(
      `
      SELECT id, name, calories_per_100g, protein_per_100g, fat_per_100g,
             carbs_per_100g, fiber_per_100g, image_url
      FROM my_foods
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY id
      LIMIT $2 OFFSET $3
      `,
      [req.user.id, PAGE_SIZE, PAGE_SIZE * (page - 1)],
    );

    const foods = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        image_url: row.image_url ? await presignRead(row.image_url) : null,
      })),
    );

    return res.status(200).json({ foods, page, pageSize: PAGE_SIZE });
  } catch (error) {
    next(error);
  }
};

export const updateMyFoodById = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const foodId = parseId(req.params.foodId, "food id");
    const fields = validateFoodPayload(req.body, { partial: true });
    const imageKey =
      req.body.image === undefined
        ? null
        : assertKeyUnderPrefix(req.body.image, myFoodPrefix(userId));

    const { rowCount } = await pool.query(
      `
      UPDATE my_foods SET
        name              = COALESCE($3, name),
        calories_per_100g = COALESCE($4, calories_per_100g),
        protein_per_100g  = COALESCE($5, protein_per_100g),
        fat_per_100g      = COALESCE($6, fat_per_100g),
        carbs_per_100g    = COALESCE($7, carbs_per_100g),
        fiber_per_100g    = COALESCE($8, fiber_per_100g),
        image_url         = COALESCE($9, image_url)
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `,
      [
        foodId,
        userId,
        fields.name ?? null,
        fields.calories_per_100g ?? null,
        fields.protein_per_100g ?? null,
        fields.fat_per_100g ?? null,
        fields.carbs_per_100g ?? null,
        fields.fiber_per_100g ?? null,
        imageKey,
      ],
    );

    if (rowCount === 0) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.status(200).json({ message: "Food updated" });
  } catch (error) {
    next(error);
  }
};
