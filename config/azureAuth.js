import passport from "passport";
import { OIDCStrategy } from "passport-azure-ad";
import dotenv from "dotenv";

dotenv.config();

const azureConfig = {
  identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0/.well-known/openid-configuration`,
  clientID: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  responseType: "code",
  responseMode: "form_post",
  redirectUrl: "http://localhost:5001/api/auth/login/microsoft/callback",
  allowHttpForRedirectUrl: true,
  scope: ["openid", "profile", "email", "User.Read"],
  passReqToCallback: false,
};

passport.use(
  new OIDCStrategy(azureConfig, (iss, sub, profile, accessToken, refreshToken, done) => {
    if (!profile.oid) return done(new Error("No OID found in user profile"), null);
    return done(null, profile);
  })
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

export default passport;
