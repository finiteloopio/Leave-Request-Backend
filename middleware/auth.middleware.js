import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Use same secret as login
      const secret = process.env.JWT_SECRET || 'supersecret';
      const decoded = jwt.verify(token, secret);

      console.log("✅ Token verified:", decoded.email, "Role:", decoded.role);

      // Attach user data to request
      req.user = decoded;

      next();
    } catch (error) {
      console.error("❌ Token verification failed:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    console.error("❌ No token provided");
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};