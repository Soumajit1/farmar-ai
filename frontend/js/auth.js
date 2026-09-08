const roleButtons = document.querySelectorAll(".role-btn");

let selectedRole = "farmer";

roleButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    roleButtons.forEach((b) => {
      b.classList.remove("active");
    });

    btn.classList.add("active");

    selectedRole = btn.dataset.role;

    console.log("Selected role:", selectedRole);
  });
});

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  errorMsg.textContent = "";

  const identifier = document
    .getElementById("identifier")
    .value
    .trim();

  const password = document
    .getElementById("password")
    .value;

  console.log("IDENTIFIER:", identifier);
  console.log(
    "PASSWORD:",
    password ? "provided" : "missing"
  );
  console.log("ROLE:", selectedRole);

  if (!identifier || !password || !selectedRole) {
    errorMsg.textContent =
      "Please fill in all fields.";
    return;
  }

  const loginButton =
    loginForm.querySelector(
      'button[type="submit"]'
    );

  const oldText =
    loginButton.textContent;

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  try {
    const response = await fetch(
      "http://localhost:5000/api/auth/login",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          identifier: identifier,
          password: password,
          role: selectedRole
        })
      }
    );

    const data = await response.json();

    console.log(
      "Backend response:",
      data
    );

    if (!response.ok) {
      errorMsg.textContent =
        data.message ||
        "Login failed.";

      return;
    }

    localStorage.setItem(
      "agrilink_token",
      data.token
    );

    localStorage.setItem(
      "agrilink_role",
      data.user.role
    );

    localStorage.setItem(
      "agrilink_user",
      data.user.name
    );

    localStorage.setItem(
      "agrilink_email",
      data.user.email
    );

    localStorage.setItem(
      "agrilink_user_id",
      data.user.id
    );

    const dashboards = {
      farmer: "dashboard-farmer.html",
      buyer: "dashboard-buyer.html",
      fpo: "dashboard-fpo.html",
      admin: "dashboard-admin.html"
    };

    const dashboard =
      dashboards[data.user.role];

    if (!dashboard) {
      errorMsg.textContent =
        "Invalid user role.";

      return;
    }

    window.location.href = dashboard;

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    errorMsg.textContent =
      "Unable to connect to backend. Make sure the server is running.";

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = oldText;
  }
});