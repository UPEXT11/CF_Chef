/* <!------- Stage 1: Configuration -------> */

const LOGIN_PAGE = "./login.html";
const REGISTER_PAGE = "./register.html";
const DASHBOARD_PAGE = "./dashboard.html";

/* <!------- Stage 2: DOM Elements -------> */

const logo = document.getElementById("brandLogo");
const logoFallback = document.getElementById("logoFallback");

const statusMessage = document.getElementById("statusMessage");
const statusText = document.getElementById("statusText");

const yearElement = document.getElementById("year");

/* <!------- Stage 3: Copyright Year -------> */

if (yearElement) {
yearElement.textContent = new Date().getFullYear();
}

/* <!------- Stage 4: Logo Fallback -------> */

function showLogoFallback() {

logo.style.display = "none";
logoFallback.style.display = "grid";

}

logo.addEventListener("error", showLogoFallback);

if (logo.complete && logo.naturalWidth === 0) {
showLogoFallback();
}

/* <!------- Stage 5: Status Messages -------> */

function updateStatus(message, isError = false) {

statusText.textContent = message;

statusMessage.classList.toggle("error", isError);

}

/* <!------- Stage 6: Supabase Initialization -------> */

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

/* <!------- Stage 7: Existing Session Check -------> */

async function checkExistingSession() {

try {

    updateStatus("Checking your kitchen access...");

    const client = initializeSupabase();

    const { data, error } = await client.auth.getSession();

    if (error) {
        throw error;
    }

    /* <!------- Stage 8: Dashboard Navigation -------> */

    if (data.session) {

        updateStatus("Welcome back! Opening your dashboard...");

        window.location.replace(DASHBOARD_PAGE);

        return;

    }

    /* <!------- Stage 9: Authentication Choices -------> */

    updateStatus("Choose how you want to continue.");

} catch (error) {

    console.error("CF Chef authentication error:", error);

    updateStatus(
        "Connection unavailable. Please check your internet connection.",
        true
    );

    // Keep login and registration options accessible.
    // Their own pages will handle authentication errors.

}

}

/* <!------- Stage 10: Navigation Validation -------> */

function setupNavigation() {

const loginLink = document.querySelector(".login-card");
const registerLink = document.querySelector(".register-card");

if (loginLink) {
    loginLink.href = LOGIN_PAGE;
}

if (registerLink) {
    registerLink.href = REGISTER_PAGE;
}

}

/* <!------- Stage 11: Start Authentication Gateway -------> */

setupNavigation();

checkExistingSession();