import { createUsersTable } from "./users.modal.js";
import { createMealTypesTable, seedMealTypesTable } from "./mealTypes.modal.js";
import { createFoodsTable } from "./foods.modal.js";
import { createMyFoodsTable } from "./myFoods.modal.js";
import { createGoalsTable } from "./goals.modal.js";
import { createMealsTable } from "./meals.modal.js";
import { createDailyProgressTable } from "./dailyProgress.modal.js";
import { createMealFoodsTable } from "./mealFoods.modal.js";

export const initializeDatabase = async () => {
  await createUsersTable();
  await createMealTypesTable();
  await seedMealTypesTable();
  await createFoodsTable();
  await createMyFoodsTable();
  await createGoalsTable();
  await createMealsTable();
  await createDailyProgressTable();
  await createMealFoodsTable();
};
