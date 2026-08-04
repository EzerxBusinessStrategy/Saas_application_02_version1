async function test() {
  console.log("Calling POST http://localhost:3000/api/auth/login...");
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "superadmin@abc.com",
      password: "Super@1234",
      rememberMe: false,
    }),
  });
  console.log("Response status:", res.status, `(took ${Date.now() - start}ms)`);
  const body = await res.json();
  console.log("Response body:", JSON.stringify(body, null, 2));
}

test().catch(console.error);
