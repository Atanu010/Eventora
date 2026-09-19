# Tests

Authentication integration tests use synthetic `example.test` accounts against the configured development PostgreSQL database. They clean up their test users after each run.

Run them with:

```bash
npm run test:auth
```

Set `TEST_DATABASE_URL` when using an isolated test database. If it is not set, the test runner uses `DATABASE_URL` and then the local Docker development connection.
