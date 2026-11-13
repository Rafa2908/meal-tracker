// Soft delete for catalog and personal foods. A hard delete either fails once
// a meal references the food (FK) or, with CASCADE, destroys meal history.
export const up = (pgm) => {
  pgm.addColumn("foods", { deleted_at: { type: "timestamptz" } });
  pgm.addColumn("my_foods", { deleted_at: { type: "timestamptz" } });
};

export const down = (pgm) => {
  pgm.dropColumn("foods", "deleted_at");
  pgm.dropColumn("my_foods", "deleted_at");
};
