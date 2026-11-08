/* <!------- Stage 1: Configuration -------> */

const DASHBOARD_PAGE = "./dashboard.html";
const LOGIN_PAGE = "./login.html";


/* <!------- Stage 2: DOM Elements -------> */

const registerForm = document.getElementById("registerForm");

const fullNameInput = document.getElementById("fullName");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const atcInput = document.getElementById("atc");

const termsInput = document.getElementById("terms");

const registerButton = document.getElementById("registerButton");
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


/* <!------- Stage 4: Supabase Initialization -------> */

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

    messageBox.classList.toggle(
        "success",
        type === "success"
    );

    messageText.textContent = message;

}

function clearMessage() {

    messageBox.hidden = true;
    messageBox.classList.remove("success");

    messageText.textContent = "";

}


/* <!------- Stage 6: Loading State -------> */

function setLoading(isLoading) {

    registerButton.disabled = isLoading;

    buttonText.textContent = isLoading
        ? "Creating your account..."
        : "Create Chef Account";

}


/* <!------- Stage 7: Password Visibility -------> */

document.querySelectorAll(".password-toggle").forEach(button => {

    button.addEventListener("click", () => {

        const target = document.getElementById(
            button.dataset.target
        );

        if (!target) return;

        const isHidden = target.type === "password";

        target.type = isHidden ? "text" : "password";

        button.textContent = isHidden ? "HIDE" : "SHOW";

    });

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

        console.error("Session check error:", error);

        showMessage(
            "Unable to connect to Supabase. Please check your configuration."
        );

    }

}


/* <!------- Stage 10: Form Validation -------> */

function validateRegistration() {

    const fullName = fullNameInput.value.trim();
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const phone = phoneInput.value.trim();

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const atc = atcInput.value.trim();

    if (
        !fullName ||
        !username ||
        !email ||
        !phone ||
        !password ||
        !confirmPassword ||
        !atc
    ) {
        return "Please complete all fields.";
    }

    if (fullName.length < 2 || fullName.length > 80) {
        return "Please enter a valid full name.";
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        return "Username must contain 3–24 letters, numbers or underscores.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Please enter a valid email address.";
    }

    if (!/^\+?[0-9\s()-]{7,20}$/.test(phone)) {
        return "Please enter a valid phone number.";
    }

    if (password.length < 8) {
        return "Your password must contain at least 8 characters.";
    }

    if (password.length > 128) {
        return "Your password is too long.";
    }

    if (password !== confirmPassword) {
        return "Your passwords do not match.";
    }

    if (!termsInput.checked) {
        return "Please accept the terms and conditions.";
    }

    return null;

}


/* <!------- Stage 11: ATC Verification -------> */

async function verifyATC(atc) {

    const { data, error } = await supabaseClient.rpc(
        "verify_chef_atc",
        {
            p_atc: atc
        }
    );

    if (error) {
        console.error("ATC verification error:", error);

        throw new Error(
            "Unable to verify your ATC right now. Please try again."
        );
    }

    return data === true;

}


/* <!------- Stage 12: Registration Error Handler -------> */

function getRegistrationError(error) {

    const message = (error.message || "").toLowerCase();

    if (
        message.includes("invalid or inactive atc") ||
        message.includes("check_violation")
    ) {
        return "Your ATC is invalid or inactive. Please check your code.";
    }

    if (
        message.includes("already registered") ||
        message.includes("already exists") ||
        message.includes("user already registered")
    ) {
        return "An account with this email may already exist. Try logging in.";
    }

    if (
        message.includes("password should be") ||
        message.includes("password")
    ) {
        return "Your password does not meet the authentication requirements.";
    }

    if (
        message.includes("network") ||
        message.includes("fetch")
    ) {
        return "Network error. Please check your internet connection.";
    }

    if (message.includes("rate limit")) {
        return "Too many attempts. Please wait and try again.";
    }

    return "Registration failed. Please try again.";

}


/* <!------- Stage 13: Supabase Account Creation -------> */

async function createChefAccount(details) {

    const { data, error } = await supabaseClient.auth.signUp({

        email: details.email,

        password: details.password,

        options: {

            data: {

                account_type: "chef",

                full_name: details.fullName,

                username: details.username,

                phone: details.phone,

                atc: details.atc

            }

        }

    });

    if (error) {
        throw error;
    }

    return data;

}


/* <!------- Stage 14: Registration Submission -------> */

registerForm.addEventListener("submit", async event => {

    event.preventDefault();

    clearMessage();

    const validationError = validateRegistration();

    if (validationError) {

        showMessage(validationError);

        return;

    }

    const details = {

        fullName: fullNameInput.value.trim(),

        username: usernameInput.value.trim(),

        email: emailInput.value.trim().toLowerCase(),

        phone: phoneInput.value.trim(),

        password: passwordInput.value,

        atc: atcInput.value.trim()

    };

    setLoading(true);

    try {

        if (!supabaseClient) {
            supabaseClient = initializeSupabase();
        }


        /* <!------- Stage 15: Check ATC -------> */

        showMessage(
            "Verifying your authorization code...",
            "success"
        );

        const isValidATC = await verifyATC(details.atc);

        if (!isValidATC) {

            throw new Error("Invalid or inactive ATC.");

        }


        /* <!------- Stage 16: Create Account -------> */

        showMessage(
            "ATC verified. Creating your chef account...",
            "success"
        );

        const result = await createChefAccount(details);


        /* <!------- Stage 17: Handle Signup Result -------> */

        if (result.session) {

            showMessage(
                "Welcome to CF Chef! Opening your dashboard...",
                "success"
            );

            window.location.replace(DASHBOARD_PAGE);

            return;

        }

        if (result.user) {

            showMessage(
                "Your account has been created. Please check your email to confirm your address, then log in.",
                "success"
            );

            registerForm.reset();

            setLoading(false);

            return;

        }

        throw new Error("Account creation could not be confirmed.");

    } catch (error) {

        console.error("Registration error:", error);

        showMessage(getRegistrationError(error));

        setLoading(false);

    }

});


/* <!------- Stage 18: Initial Setup -------> */

checkExistingSession();