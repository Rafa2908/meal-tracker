export const getHealthStatus = async (req, res) => {
  try {
    return res.status(200).json({ status: "OK" });
  } catch (error) {
    console.error(error.message);

    return res.status(500).json({ message: "Internal Server Error" });
  }
};
