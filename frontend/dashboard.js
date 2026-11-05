
/* =====================================================
   CF CHEF — DASHBOARD JAVASCRIPT
===================================================== */


/* <!------- Stage 1: Configuration -------> */

const LOGIN_PAGE = "./login.html";


/* <!------- Stage 2: DOM Elements -------> */

const welcomeName = document.getElementById("welcomeName");

const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileEmail = document.getElementById("profileEmail");
const profilePhone = document.getElementById("profilePhone");
const profileId = document.getElementById("profileId");
const profileJoined = document.getElementById("profileJoined");

const profileAvatar = document.getElementById("profileAvatar");
const topAvatar = document.getElementById("topAvatar");

const accountStatus = document.getElementById("accountStatus");
const statusBadge = document.getElementById("statusBadge");

const logoutBtn = document.getElementById("logoutBtn");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const toast = document.getElementById("toast");


/* <!------- Stage 3: Supabase Initialization -------> */

let supabaseClient = null;
let currentUser = null;


/* <!------- Stage 4: Toast Notifications -------> */

function showToast(message, type = "success") {

    toast.textContent = message;
    toast.className = "toast show";

    if (type === "error") {
        toast.classList.add("error");
    }

    window.clearTimeout(showToast.timeout);

    showToast.timeout = window.setTimeout(() => {
        toast.className = "toast";
    }, 3500);

}


/* <!------- Stage 5: Avatar Initials -------> */

function getInitials(name) {

    const words = String(name || "Chef")
        .trim()
        .split(/\s+/);

    return words
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("") || "C";

}


/* <!------- Stage 6: Date Formatting -------> */

function formatDate(dateValue) {

    if (!dateValue) {
        return "Not available";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

}


/* <!------- Stage 7: Dashboard Loading -------> */

async function initializeDashboard() {

    try {

        if (!window.supabase || !window.supabase.createClient) {
            throw new Error("Supabase SDK failed to load.");
        }

        if (
            !window.CF_SUPABASE_URL ||
            !window.CF_SUPABASE_KEY
        ) {
            throw new Error("Supabase configuration is missing.");
        }

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


        /* <!------- Stage 8: Session Verification -------> */

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData.session;

        if (!session) {
            window.location.replace(LOGIN_PAGE);
            return;
        }


        /* <!------- Stage 9: User Verification -------> */

        const {
            data: userData,
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            await supabaseClient.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return;
        }

        currentUser = userData.user;


        /* <!------- Stage 10: Chef Profile Retrieval -------> */

        const {
            data: chefProfile,
            error: profileError
        } = await supabaseClient
            .from("chef_profiles")
            .select(`
                id,
                full_name,
                username,
                phone,
                created_at
            `)
            .eq("id", currentUser.id)
            .maybeSingle();


        if (profileError) {
            throw profileError;
        }

        if (!chefProfile) {

            accountStatus.textContent =
                "No chef profile was found for this account.";

            statusBadge.textContent = "Profile missing";
            statusBadge.style.color = "#ff7185";

            showToast(
                "Your chef profile could not be found.",
                "error"
            );

            return;
        }


        /* <!------- Stage 11: Populate Chef Information -------> */

        const fullName = chefProfile.full_name || "Chef";

        welcomeName.textContent = fullName.split(/\s+/)[0];

        profileName.textContent = fullName;

        profileUsername.textContent =
            "@" + chefProfile.username;

        profileEmail.textContent =
            currentUser.email || "Not available";

        profilePhone.textContent =
            chefProfile.phone || "Not provided";

        profileId.textContent =
            chefProfile.id;

        profileJoined.textContent =
            formatDate(chefProfile.created_at);


        /* <!------- Stage 12: Populate Avatar -------> */

        const initials = getInitials(fullName);

        profileAvatar.textContent = initials;
        topAvatar.textContent = initials;


        /* <!------- Stage 13: Account Status -------> */

        accountStatus.textContent =
            "Your chef profile is connected and accessible.";

        statusBadge.textContent = "Access active";
        statusBadge.style.color = "#45d6a0";


        /* <!------- Stage 14: Dashboard Ready -------> */

        document.title = `Dashboard | ${fullName}`;

    } catch (error) {

        console.error("Dashboard Error:", error);

        accountStatus.textContent =
            "Unable to load your dashboard. Please try again.";

        statusBadge.textContent = "Connection error";
        statusBadge.style.color = "#ff7185";

        showToast(
            error.message || "Something went wrong.",
            "error"
        );

    }

}


/* <!------- Stage 15: Logout -------> */

async function logoutUser() {

    if (!supabaseClient) {
        window.location.replace(LOGIN_PAGE);
        return;
    }

    logoutBtn.disabled = true;
    logoutBtn.innerHTML =
        '<i class="fa-solid fa-spinner fa-spin"></i><span>Signing out...</span>';

    try {

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace(LOGIN_PAGE);

    } catch (error) {

        console.error("Logout Error:", error);

        showToast("Unable to sign out. Please try again.", "error");

        logoutBtn.disabled = false;
        logoutBtn.innerHTML =
            '<i class="fa-solid fa-right-from-bracket"></i><span>Sign Out</span>';

    }

}


/* <!------- Stage 16: Mobile Sidebar -------> */

menuBtn.addEventListener("click", () => {

    sidebar.classList.toggle("open");

});


/* <!------- Stage 17: Sidebar Navigation -------> */

document.querySelectorAll(".nav-link").forEach(link => {

    link.addEventListener("click", () => {

        sidebar.classList.remove("open");

        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");

    });

});


/* <!------- Stage 18: Logout Event -------> */

logoutBtn.addEventListener("click", logoutUser);


/* <!------- Stage 19: Current Year -------> */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();


/* <!------- Stage 20: Start Dashboard -------> */

initializeDashboard();
