
/* =====================================================
   CF CHEF — PROFILE JAVASCRIPT
===================================================== */


/* <!------- Stage 1: Configuration -------> */

const LOGIN_PAGE = "./login.html";


/* <!------- Stage 2: DOM Elements -------> */

const profileForm = document.getElementById("profileForm");

const fullNameInput = document.getElementById("fullName");
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");

const heroName = document.getElementById("heroName");
const heroUsername = document.getElementById("heroUsername");

const heroAvatar = document.getElementById("heroAvatar");
const topAvatar = document.getElementById("topAvatar");

const chefId = document.getElementById("chefId");
const atcCode = document.getElementById("atcCode");
const joinedDate = document.getElementById("joinedDate");

const saveBtn = document.getElementById("saveBtn");
const formMessage = document.getElementById("formMessage");

const logoutBtn = document.getElementById("logoutBtn");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

const toast = document.getElementById("toast");


/* <!------- Stage 3: Supabase Variables -------> */

let supabaseClient = null;
let currentUser = null;
let originalProfile = null;


/* <!------- Stage 4: Toast Notifications -------> */

function showToast(message, type = "success") {

    toast.textContent = message;
    toast.className = "toast show";

    if (type === "error") {
        toast.classList.add("error");
    }

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        toast.className = "toast";
    }, 3500);

}


/* <!------- Stage 5: Form Messages -------> */

function setFormMessage(message, type = "") {

    formMessage.textContent = message;
    formMessage.className = "form-message";

    if (type) {
        formMessage.classList.add(type);
    }

}


/* <!------- Stage 6: Avatar Initials -------> */

function getInitials(name) {

    const words = String(name || "Chef")
        .trim()
        .split(/\s+/);

    return words
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("") || "C";

}


/* <!------- Stage 7: Date Formatting -------> */

function formatDate(value) {

    if (!value) {
        return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

}


/* <!------- Stage 8: Load Profile -------> */

async function loadProfile() {

    try {

        /* Initialize Supabase */

        if (
            !window.supabase ||
            !window.supabase.createClient
        ) {
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


        /* <!------- Stage 9: Verify Session -------> */

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!sessionData.session) {
            window.location.replace(LOGIN_PAGE);
            return;
        }


        /* <!------- Stage 10: Verify User -------> */

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


        /* <!------- Stage 11: Retrieve Chef Profile -------> */

        const {
            data: profile,
            error: profileError
        } = await supabaseClient
            .from("chef_profiles")
            .select(`
                id,
                full_name,
                username,
                phone,
                atc_code,
                created_at,
                updated_at
            `)
            .eq("id", currentUser.id)
            .maybeSingle();


        if (profileError) {
            throw profileError;
        }

        if (!profile) {

            setFormMessage(
                "No chef profile was found for this account.",
                "error"
            );

            showToast(
                "Chef profile not found.",
                "error"
            );

            profileForm.querySelectorAll("input, button")
                .forEach(element => {
                    element.disabled = true;
                });

            return;

        }

        originalProfile = profile;


        /* <!------- Stage 12: Populate Editable Fields -------> */

        fullNameInput.value = profile.full_name || "";

        phoneInput.value = profile.phone || "";


        /* <!------- Stage 13: Populate Protected Fields -------> */

        usernameInput.value = profile.username || "";

        emailInput.value = currentUser.email || "";

        chefId.textContent = profile.id || "Not available";

        atcCode.textContent = profile.atc_code || "Not available";

        joinedDate.textContent = formatDate(profile.created_at);


        /* <!------- Stage 14: Populate Profile Header -------> */

        heroName.textContent = profile.full_name || "Chef";

        heroUsername.textContent =
            "@" + (profile.username || "chef");

        const initials = getInitials(profile.full_name);

        heroAvatar.textContent = initials;
        topAvatar.textContent = initials;


        /* <!------- Stage 15: Profile Ready -------> */

        document.title =
            `My Profile | ${profile.full_name || "CF Chef"}`;

        setFormMessage(
            "Your changes will be saved to your account."
        );

    } catch (error) {

        console.error("Profile Loading Error:", error);

        setFormMessage(
            error.message || "Unable to load your profile.",
            "error"
        );

        showToast(
            "Unable to load profile information.",
            "error"
        );

    }

}


/* <!------- Stage 16: Validate Profile -------> */

function validateProfile(fullName, phone) {

    if (fullName.length < 2 || fullName.length > 80) {
        return "Full name must contain 2–80 characters.";
    }

    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) {
        return "Enter a valid phone number.";
    }

    return null;

}


/* <!------- Stage 17: Save Profile -------> */

async function saveProfile(event) {

    event.preventDefault();

    if (!supabaseClient || !currentUser || !originalProfile) {
        showToast("Profile is not ready yet.", "error");
        return;
    }

    const fullName = fullNameInput.value.trim();
    const phone = phoneInput.value.trim();

    const validationError = validateProfile(
        fullName,
        phone
    );

    if (validationError) {

        setFormMessage(validationError, "error");

        showToast(validationError, "error");

        return;

    }


    /* Check whether anything changed */

    if (
        fullName === originalProfile.full_name &&
        phone === originalProfile.phone
    ) {

        setFormMessage("No changes to save.");

        showToast("Your profile is already up to date.");

        return;

    }


    /* <!------- Stage 18: Update Supabase -------> */

    saveBtn.disabled = true;

    saveBtn.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Saving...</span>
    `;

    setFormMessage("Saving your profile...");

    try {

        const {
            data: updatedProfile,
            error: updateError
        } = await supabaseClient
            .from("chef_profiles")
            .update({
                full_name: fullName,
                phone: phone
            })
            .eq("id", currentUser.id)
            .select(`
                id,
                full_name,
                username,
                phone,
                atc_code,
                created_at,
                updated_at
            `)
            .single();


        if (updateError) {
            throw updateError;
        }


        /* <!------- Stage 19: Update Local Profile -------> */

        originalProfile = updatedProfile;

        heroName.textContent = updatedProfile.full_name;

        heroUsername.textContent =
            "@" + updatedProfile.username;

        const initials = getInitials(
            updatedProfile.full_name
        );

        heroAvatar.textContent = initials;
        topAvatar.textContent = initials;

        document.title =
            `My Profile | ${updatedProfile.full_name}`;


        setFormMessage(
            "Your profile has been updated successfully.",
            "success"
        );

        showToast("Profile updated successfully.");

    } catch (error) {

        console.error("Profile Update Error:", error);

        let message = "Unable to update your profile.";

        if (
            error.message &&
            error.message.toLowerCase().includes("permission")
        ) {
            message = "You do not have permission to update these fields.";
        }

        if (
            error.message &&
            error.message.toLowerCase().includes("network")
        ) {
            message = "Network error. Please try again.";
        }

        setFormMessage(message, "error");

        showToast(message, "error");

    } finally {

        saveBtn.disabled = false;

        saveBtn.innerHTML = `
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Save Changes</span>
        `;

    }

}


/* <!------- Stage 20: Logout -------> */

async function logoutUser() {

    if (!supabaseClient) {
        window.location.replace(LOGIN_PAGE);
        return;
    }

    logoutBtn.disabled = true;

    logoutBtn.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Signing out...</span>
    `;

    try {

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace(LOGIN_PAGE);

    } catch (error) {

        console.error("Logout Error:", error);

        showToast(
            "Unable to sign out. Please try again.",
            "error"
        );

        logoutBtn.disabled = false;

        logoutBtn.innerHTML = `
            <i class="fa-solid fa-right-from-bracket"></i>
            <span>Sign Out</span>
        `;

    }

}


/* <!------- Stage 21: Mobile Sidebar -------> */

menuBtn.addEventListener("click", () => {

    sidebar.classList.toggle("open");

});


/* <!------- Stage 22: Profile Form Event -------> */

profileForm.addEventListener("submit", saveProfile);


/* <!------- Stage 23: Logout Event -------> */

logoutBtn.addEventListener("click", logoutUser);


/* <!------- Stage 24: Current Year -------> */

document.getElementById("currentYear").textContent =
    new Date().getFullYear();


/* <!------- Stage 25: Start Profile Page -------> */

loadProfile();
