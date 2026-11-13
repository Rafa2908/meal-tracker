import { HttpError } from "./httpError.js";

const NAME_REGEX = /^[\p{L}\p{N}](?:[\p{L}\p{N}\s'&.,()%/-]*[\p{L}\p{N}])?$/u;

export const MACRO_FIELDS = [
  "calories_per_100g",
  "protein_per_100g",
  "fat_per_100g",
  "carbs_per_100g",
  "fiber_per_100g",
];

const MACRO_MAX = 9999.99; // largest value NUMERIC(6,2) can hold
const PG_INT_MAX = 2147483647; // SERIAL / INTEGER upper bound

// Route params and query strings always arrive as strings.
// Accept only plain positive integers that fit in a Postgres INTEGER.
export const parseId = (raw, label = "id") => {
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw new HttpError(400, `Invalid ${label}`);
  }

  const value = Number(raw);

  if (value < 1 || value > PG_INT_MAX) {
    throw new HttpError(400, `Invalid ${label}`);
  }

  return value;
};

export const parsePage = (raw) => parseId(raw, "page number");

// Accepts only a real calendar date in YYYY-MM-DD form and returns it as-is.
export const parseDate = (raw) => {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpError(400, "date must be YYYY-MM-DD");
  }

  const date = new Date(`${raw}T00:00:00Z`);

  // The round trip catches dates like 2026-02-30, which Date silently rolls over
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, "Invalid date");
  }

  return raw;
};

// Validates a food body. With partial: true (PATCH), only the fields that
// were sent are checked and returned; missing fields are left out.
export const validateFoodPayload = (body, { partial = false } = {}) => {
  const input = body ?? {};
  const out = {};

  if (!partial || input.name !== undefined) {
    const name = typeof input.name === "string" ? input.name.trim() : "";

    if (!name || name.length > 255 || !NAME_REGEX.test(name)) {
      throw new HttpError(400, "Please provide a valid food name");
    }

    out.name = name;
  }

  for (const field of MACRO_FIELDS) {
    const value = input[field];

    if (partial && value === undefined) continue;

    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new HttpError(400, `${field} must be a number`);
    }

    if (value < 0 || value > MACRO_MAX) {
      throw new HttpError(400, `${field} must be between 0 and ${MACRO_MAX}`);
    }

    out[field] = value;
  }

  if (partial && Object.keys(out).length === 0 && input.image === undefined) {
    throw new HttpError(400, "No fields to update");
  }

  return out;
};
