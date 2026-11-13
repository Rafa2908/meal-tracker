// Runs before every test file (jest.setupFiles). Presigning is local signing,
// so tests never need real AWS credentials: force dummy ones so a developer's
// own (possibly expired) AWS session is never picked up.
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";
delete process.env.AWS_SESSION_TOKEN;
delete process.env.AWS_PROFILE;
