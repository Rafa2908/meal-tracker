export const authenticateAdmin = (req, res, next) => {
  if (!req.user?.groups?.includes("Admins")) {
    return res.status(403).json({ message: "Not permitted. Admin only" });
  }

  next();
};
