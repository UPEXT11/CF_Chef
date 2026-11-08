/* <!------- Stage 1: Configuration -------> */

const LOADER_DURATION = 4500;

const AUTH_PAGE = "./auth.html";
const DASHBOARD_PAGE = "./dashboard.html";


/* <!------- Stage 2: DOM Elements -------> */

const logo = document.getElementById("brandLogo");
const logoFallback = document.getElementById("logoFallback");

const progressBar = document.getElementById("loadingProgress");
const progressTrack = document.getElementById("progressTrack");

const progressText = document.getElementById("loadingPercent");
const loadingText = document.getElementById("loadingText");

const footerStatus = document.getElementById("footerStatus");
const loadingArea = document.querySelector(".loading-area");


/* <!------- Stage 3: Logo Fallback -------> */

function showLogoFallback() {

    logo.style.display = "none";
    logoFallback.style.display = "grid";

}

logo.addEventListener("error", showLogoFallback);

if (logo.complete && logo.naturalWidth === 0) {
    showLogoFallback();
}


/* <!------- Stage 4: Loading Messages -------> */

const messages = [
    { at: 0, text: "Preparing your kitchen" },
    { at: 25, text: "Bringing passion to the table" },
    { at: 52, text: "Connecting to CF Chef" },
    { at: 78, text: "Checking your kitchen access" },
    { at: 96, text: "Almost ready" }
];


/* <!------- Stage 5: Supabase Initialization -------> */

let supabaseClient = null;

function initializeSupabase() {

    if (!window.supabase || !window.supabase.createClient) {
        throw new Error("Supabase SDK failed to load.");
    }

    if (!window.CF_SUPABASE_URL || !window.CF_SUPABASE_KEY) {
        throw new Error("Supabase configuration is missing.");
    }

    if (!supabaseClient) {

        supabaseClient = window.supabase.createClient(
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

    return supabaseClient;

}


/* <!------- Stage 6: Check Chef Session -------> */

async function checkChefSession() {

    const client = initializeSupabase();

    const { data, error } = await client.auth.getSession();

    if (error) {
        throw error;
    }

    return data.session;

}


/* <!------- Stage 7: Cinematic Progress -------> */

const startTime = performance.now();

let lastMessage = "";
let loaderFinished = false;

const loaderPromise = new Promise(resolve => {

    function animateLoader(now) {

        const elapsed = now - startTime;

        const progress = Math.min(
            (elapsed / LOADER_DURATION) * 100,
            100
        );

        const roundedProgress = Math.floor(progress);

        progressBar.style.width = `${progress}%`;

        progressText.textContent = `${roundedProgress}%`;

        progressTrack.setAttribute(
            "aria-valuenow",
            String(roundedProgress)
        );

        const currentMessage = [...messages]
            .reverse()
            .find(message => progress >= message.at);

        if (
            currentMessage &&
            currentMessage.text !== lastMessage
        ) {

            loadingText.textContent = currentMessage.text;

            lastMessage = currentMessage.text;

        }

        if (progress < 100) {

            requestAnimationFrame(animateLoader);

            return;

        }

        loaderFinished = true;

        resolve();

    }

    requestAnimationFrame(animateLoader);

});


/* <!------- Stage 8: Error Handling -------> */

function showStartupError(error) {

    console.error("CF Chef startup error:", error);

    loadingText.textContent = "Connection unavailable";

    footerStatus.textContent = "PLEASE CHECK YOUR INTERNET CONNECTION";

    progressBar.style.width = "100%";

    progressText.textContent = "100%";

    progressTrack.setAttribute("aria-valuenow", "100");

    const retryButton = document.createElement("button");

    retryButton.type = "button";
    retryButton.textContent = "Try Again";

    retryButton.className = "retry-button";

    retryButton.addEventListener("click", () => {
        window.location.reload();
    });

    loadingArea.appendChild(retryButton);

}


/* <!------- Stage 9: Startup Process -------> */

async function startChefApp() {

    try {

        // Check Supabase while the loader runs.

        const sessionPromise = checkChefSession();

        // Wait until both tasks finish.

        const [session] = await Promise.all([
            sessionPromise,
            loaderPromise
        ]);

        loadingText.textContent = session
            ? "Welcome back, Chef!"
            : "Welcome to CF Chef";

        footerStatus.textContent = session
            ? "OPENING YOUR KITCHEN"
            : "PREPARING YOUR SIGN-IN";

        /* <!------- Stage 10: Navigation -------> */

        const destination = session
            ? DASHBOARD_PAGE
            : AUTH_PAGE;

        window.location.replace(destination);

    } catch (error) {

        // Ensure the loader finishes before showing an error.

        if (!loaderFinished) {
            await loaderPromise;
        }

        showStartupError(error);

    }

}


/* <!------- Stage 11: Start Application -------> */

startChefApp();