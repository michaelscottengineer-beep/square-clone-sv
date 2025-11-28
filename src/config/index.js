const fileEnv = process.env;
const env = {
  CLIENT_BASE_URL: fileEnv.CLIENT_BASE_URL,
  STRIPE_BASE_URL: fileEnv.STRIPE_BASE_URL,
  GOOGLE_APP_PASSWORD: fileEnv.STRIPE_BASE_URL,
};

const ORIGINALS = {
  global: [env.CLIENT_BASE_URL],
};

module.exports = {
  env,
  ORIGINALS,
};
