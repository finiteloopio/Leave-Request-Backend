// Middleware to check if the user has the 'manager' role
export const isManager = (req, res, next) => {
  // This middleware should run AFTER the 'protect' middleware,
  // so the user object will be attached to the request.
  if (req.user && req.user.role === "manager") {
    next(); // User is a manager, proceed to the next function
  } else {
    // If the user is not a manager, send a 403 Forbidden error
    res.status(403).json({ message: "Access Denied. Manager role required." });
  }
};
