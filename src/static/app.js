document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const userBtn = document.getElementById("user-btn");
  const userMenu = document.getElementById("user-menu");
  const userInfo = document.getElementById("user-info");
  const logoutBtn = document.getElementById("logout-btn");
  const loginModal = document.getElementById("login-modal");
  const closeBtn = document.querySelector(".close-btn");
  const loginForm = document.getElementById("login-form");
  const loginMessage = document.getElementById("login-message");

  let isAuthenticated = false;
  let currentUser = null;

  // Check authentication status on page load
  async function checkAuthStatus() {
    try {
      const response = await fetch("/auth/status");
      const data = await response.json();
      isAuthenticated = data.authenticated;
      currentUser = data.username;
      updateUI();
      fetchActivities();
    } catch (error) {
      console.error("Error checking auth status:", error);
      fetchActivities();
    }
  }

  // Update UI based on authentication status
  function updateUI() {
    if (isAuthenticated) {
      userBtn.textContent = `👤 ${currentUser}`;
      userInfo.innerHTML = `<p>Logged in as: <strong>${currentUser}</strong></p>`;
      logoutBtn.classList.remove("hidden");
      signupContainer.classList.remove("hidden");
    } else {
      userBtn.textContent = "👤 Login";
      userInfo.innerHTML = "";
      logoutBtn.classList.add("hidden");
      signupContainer.classList.add("hidden");
    }
    // Refresh activities to show/hide delete buttons
    fetchActivities();
  }

  // Toggle user menu
  userBtn.addEventListener("click", () => {
    userMenu.classList.toggle("hidden");
  });

  // Close user menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".user-section")) {
      userMenu.classList.add("hidden");
    }
  });

  // Open login modal when not authenticated
  userBtn.addEventListener("dblclick", () => {
    if (!isAuthenticated) {
      loginModal.classList.remove("hidden");
    }
  });

  // Close modal when clicking close button
  closeBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginMessage.classList.add("hidden");
  });

  // Close modal when clicking outside
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const result = await response.json();
        loginMessage.textContent = result.message;
        loginMessage.className = "success";
        loginMessage.classList.remove("hidden");
        
        // Close modal and update UI
        setTimeout(() => {
          loginModal.classList.add("hidden");
          loginForm.reset();
          checkAuthStatus();
        }, 1000);
      } else {
        const result = await response.json();
        loginMessage.textContent = result.detail || "Login failed";
        loginMessage.className = "error";
        loginMessage.classList.remove("hidden");
      }
    } catch (error) {
      loginMessage.textContent = "Error logging in. Please try again.";
      loginMessage.className = "error";
      loginMessage.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (response.ok) {
        isAuthenticated = false;
        currentUser = null;
        updateUI();
        userMenu.classList.add("hidden");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete buttons (only for authenticated teachers)
        let participantsHTML;
        if (details.participants.length > 0) {
          const participantItems = details.participants
            .map((email) => {
              const deleteBtn = isAuthenticated
                ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                : "";
              return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
            })
            .join("");
          participantsHTML = `<div class="participants-section">
            <h5>Participants:</h5>
            <ul class="participants-list">
              ${participantItems}
            </ul>
          </div>`;
        } else {
          participantsHTML = `<p><em>No participants yet</em></p>`;
        }

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    event.preventDefault();
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus();
});
