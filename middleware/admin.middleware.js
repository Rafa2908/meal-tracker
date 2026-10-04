export const authenticateAdmin = (req, res, next) => {
  const { role } = req.user;

  try {
    if (!role.includes("Admins")) {
      return res.status(403).json({ message: "Not permitted. Admin only" });
    }

    next();
  } catch (error) {
    next(error);
  }
};
