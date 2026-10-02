// eslint-disable-next-line no-unused-vars
export const errorMiddleware = (error, req, res, next) => {
  console.error("Error: " + error.message);
  return res.status(500).json({ message: "Internal server error" });
};
