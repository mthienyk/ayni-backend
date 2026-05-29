process.env.NODE_ENV ??= "test";
process.env.API_BASE_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??=
  "postgresql://ayni:ayni@localhost:5432/ayni";
process.env.JWT_ACCESS_SECRET ??=
  "test-access-secret-min-32-characters-long";
process.env.JWT_REFRESH_SECRET ??=
  "test-refresh-secret-min-32-characters-long";
process.env.AUTO_APPROVE_PHOTOS ??= "true";
