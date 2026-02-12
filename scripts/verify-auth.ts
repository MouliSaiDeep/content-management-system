import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000/api/auth";

async function verifyAuth() {
  console.log("Starting Authentication Verification...");

  // 1. Register User
  console.log("\n1. Testing Registration...");
  const registerResponse = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "testuser_" + Date.now(),
      email: `test${Date.now()}@example.com`,
      password: "password123",
    }),
  });

  const registerData = await registerResponse.json();
  console.log("Status:", registerResponse.status);
  console.log("Response:", registerData);

  if (registerResponse.status !== 201) {
    console.error("Registration failed!");
    return;
  }

  const token = registerData.token;
  console.log("Token received:", token ? "Yes" : "No");

  // 2. Login User
  console.log("\n2. Testing Login...");
  const loginResponse = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: registerData.user.email,
      password: "password123",
    }),
  });

  const loginData = await loginResponse.json();
  console.log("Status:", loginResponse.status);
  console.log("Response:", loginData);

  if (loginResponse.status !== 200) {
    console.error("Login failed!");
    return;
  }

  // 3. Get Me (Protected Route)
  console.log("\n3. Testing /me Endpoint...");
  const meResponse = await fetch(`${BASE_URL}/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const meData = await meResponse.json();
  console.log("Status:", meResponse.status);
  console.log("Response:", meData);

  if (
    meResponse.status === 200 &&
    meData.user.email === registerData.user.email
  ) {
    console.log("\nSUCCESS: Authentication flow verified!");
  } else {
    console.error("\nFAILURE: /me endpoint did not return correct user data.");
  }
}

verifyAuth().catch(console.error);
