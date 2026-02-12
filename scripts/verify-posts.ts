import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000/api";
let AUTH_TOKEN = "";
let USER_ID = "";
let POST_ID = "";

async function verifyPosts() {
  console.log("Starting Post Verification...");

  // 1. Login to get Token
  console.log("\n1. Logging in...");
  const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com", // Assuming this user exists from previous test
      password: "password123",
    }),
  });

  if (loginResponse.status !== 200) {
    // If login fails, try to register
    console.log("Login failed, trying to register...");
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "posttester_" + Date.now(),
        email: `posttest${Date.now()}@example.com`,
        password: "password123",
      }),
    });
    const registerData = await registerResponse.json();
    if (registerResponse.status === 201) {
      AUTH_TOKEN = registerData.token;
      USER_ID = registerData.user.id;
      console.log("Registered and logged in.");
    } else {
      console.error("Registration failed. Cannot proceed.");
      return;
    }
  } else {
    const loginData = await loginResponse.json();
    AUTH_TOKEN = loginData.token;
    USER_ID = loginData.user.id;
    console.log("Logged in successfully.");
  }

  // 2. Create Post
  console.log("\n2. Creating Post...");
  const createResponse = await fetch(`${BASE_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      title: "My First Blog Post",
      content:
        "This is the content of my first blog post. It is very interesting.",
      status: "DRAFT",
    }),
  });
  const createData = await createResponse.json();
  console.log("Status:", createResponse.status);
  console.log("Response:", createData);

  if (createResponse.status === 201) {
    POST_ID = createData.id;
    console.log("Post created with ID:", POST_ID);
  } else {
    console.error("Failed to create post");
    return;
  }

  // 3. Get All Posts
  console.log("\n3. Getting All Posts...");
  const listResponse = await fetch(`${BASE_URL}/posts`, { method: "GET" });
  const listData = await listResponse.json();
  console.log("Status:", listResponse.status);
  console.log("Posts Count:", listData.data.length);

  // 4. Get Single Post
  console.log(`\n4. Getting Post ${POST_ID}...`);
  const getResponse = await fetch(`${BASE_URL}/posts/${POST_ID}`, {
    method: "GET",
  });
  const getData = await getResponse.json();
  console.log("Status:", getResponse.status);
  console.log("Title:", getData.title);

  // 5. Update Post
  console.log(`\n5. Updating Post ${POST_ID}...`);
  const updateResponse = await fetch(`${BASE_URL}/posts/${POST_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      title: "Updated Post Title",
      status: "PUBLISHED",
    }),
  });
  const updateData = await updateResponse.json();
  console.log("Status:", updateResponse.status);
  console.log("New Title:", updateData.title);
  console.log("New Status:", updateData.status);

  // 6. Delete Post
  console.log(`\n6. Deleting Post ${POST_ID}...`);
  const deleteResponse = await fetch(`${BASE_URL}/posts/${POST_ID}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
  });
  console.log("Status:", deleteResponse.status);

  if (deleteResponse.status === 204) {
    console.log("\nSUCCESS: Post flow verified!");
  } else {
    console.error("\nFAILURE: Could not delete post.");
  }
}

verifyPosts().catch(console.error);
