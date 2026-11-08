/* <!------- Stage 1: Configuration -------> */

const DASHBOARD_PAGE = "./dashboard.html";
const AUTH_PAGE = "./auth.html";

/* <!------- Stage 2: DOM Elements -------> */

const loginForm = document.getElementById("loginForm");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const passwordToggle = document.getElementById("passwordToggle");

const loginButton = document.getElementById("loginButton");
const buttonText = document.getElementById("buttonText");

const messageBox = document.getElementById("messageBox");
const messageText = document.getElementById("messageText");

const logo = document.getElementById("brandLogo");
const logoFallback = document.getElementById("logoFallback");

const yearElement = document.getElementById("year");

/* <!------- Stage 3: Copyright Year -------> */

if (yearElement) {
yearElement.textContent = new Date().getFullYear();
}

/* <!------- Stage 4: Supabase Client -------> */

function initializeSupabase() {

if (
    !window.supabase ||
    typeof window.supabase.createClient !== "function"
) {
    throw new Error("Supabase SDK could not be loaded.");
}

if (
    !window.CF_SUPABASE_URL ||
    !window.CF_SUPABASE_KEY
) {
    throw new Error("Supabase configuration is missing.");
}

return window.supabase.createClient(
    window.CF_SUPABASE_URL,
    window.CF_SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

}

let supabaseClient;

/* <!------- Stage 5: Message Handler -------> */

function showMessage(message, type = "error") {

messageBox.hidden = false;
messageBox.classList.toggle("success", type === "success");

messageText.textContent = message;

}

function clearMessage() {

messageBox.hidden = true;
messageBox.classList.remove("success");

messageText.textContent = "";

}

/* <!------- Stage 6: Button Loading State -------> */

function setLoading(isLoading) {

loginButton.disabled = isLoading;

emailInput.disabled = isLoading;
passwordInput.disabled = isLoading;

buttonText.textContent = isLoading
    ? "Signing in..."
    : "Login to CF Chef";

}

/* <!------- Stage 7: Password Visibility -------> */

passwordToggle.addEventListener("click", () => {

const isPassword = passwordInput.type === "password";

passwordInput.type = isPassword ? "text" : "password";

passwordToggle.textContent = isPassword ? "HIDE" : "SHOW";

passwordToggle.setAttribute(
    "aria-label",
    isPassword ? "Hide password" : "Show password"
);

});

/* <!------- Stage 8: Logo Fallback -------> */

function showLogoFallback() {

logo.style.display = "none";
logoFallback.style.display = "grid";

}

logo.addEventListener("error", showLogoFallback);

if (logo.complete && logo.naturalWidth === 0) {
showLogoFallback();
}

/* <!------- Stage 9: Existing Session Check -------> */

async function checkExistingSession() {

try {

    supabaseClient = initializeSupabase();

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        throw error;
    }

    if (data.session) {

        window.location.replace(DASHBOARD_PAGE);

    }

} catch (error) {

    console.error("CF Chef session check failed:", error);

    showMessage(
        "Unable to check your session. You can still try signing in."
    );

}

}

/* <!------- Stage 10: Login Validation -------> */

function validateLogin(email, password) {

if (!email || !password) {
    return "Please enter your email and password.";
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
}

if (password.length > 128) {
    return "Password is too long.";
}

return null;

}

/* <!------- Stage 11: Login Error Handler -------> */

function getLoginError(error) {

const message = (error.message || "").toLowerCase();

if (
    message.includes("invalid login credentials") ||
    message.includes("invalid email or password")
) {
    return "Incorrect email or password. Please try again.";
}

if (message.includes("email not confirmed")) {
    return "Please verify your email address before logging in.";
}

if (
    message.includes("too many requests") ||
    message.includes("rate limit")
) {
    return "Too many attempts. Please wait before trying again.";
}

if (
    message.includes("network") ||
    message.includes("fetch")
) {
    return "Network error. Check your internet connection.";
}

return "Login failed. Please check your details and try again.";

}

/* <!------- Stage 12: Supabase Login -------> */

async function loginUser(email, password) {

const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
});

if (error) {
    throw error;
}

if (!data.session || !data.user) {
    throw new Error("A valid login session was not returned.");
}

return data;

}

/* <!------- Stage 13: Form Submission -------> */

loginForm.addEventListener("submit", async (event) => {

event.preventDefault();

clearMessage();

const email = emailInput.value.trim().toLowerCase();
const password = passwordInput.value;

const validationError = validateLogin(email, password);

if (validationError) {

    showMessage(validationError);

    return;

}

setLoading(true);

try {

    if (!supabaseClient) {
        supabaseClient = initializeSupabase();
    }

    const result = await loginUser(email, password);

    console.log("CF Chef login successful:", result.user.id);

    showMessage("Welcome back! Opening your dashboard...", "success");

    window.location.replace(DASHBOARD_PAGE);

} catch (error) {

    console.error("CF Chef login error:", error);

    showMessage(getLoginError(error));

    setLoading(false);

}

});

/* <!------- Stage 14: Initial Setup -------> */

checkExistingSession();