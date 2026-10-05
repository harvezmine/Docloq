const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns 400 if any listed param is present but not a valid UUID.
export const validateUUID = (...paramNames) => (req, res, next) => {
  for (const param of paramNames) {
    const val = req.params[param];
    if (val && !UUID_RE.test(val)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${param} format`,
      });
    }
  }
  next();
};

export default { validateUUID };
