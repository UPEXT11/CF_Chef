/* =====================================================
   CF CHEFS — PROFILE DATA
===================================================== */

/* <!------- Stage 1: Configuration -------> */
const LOGIN_PAGE = "./login.html";
const PROFILE_TABLE = "chef_profiles";
const PROTECTED_FIELDS = new Set([
    "id",
    "created_at",
    "updated_at",
    "email",
    "atc_code",
    "verification_status"
]);

let supabaseClient = null;
let currentUser = null;
let originalProfile = null;

/* <!------- Stage 2: DOM Helpers -------> */
const byId = (id) => document.getElementById(id);
const profileForm = document.querySelector(".profile-form");
const profileStatus = byId("profileStatus");

function setStatus(message, type = "") {
    if (!profileStatus) {
        return;
    }

    profileStatus.textContent = message;
    profileStatus.classList.toggle("status-error", type === "error");
}

function getInitials(name) {
    return String(name || "Chef")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("") || "C";
}

function formatDate(value) {
    if (!value) {
        return "Not available";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Not available"
        : date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
}

function normalizeValues(value) {
    if (Array.isArray(value)) {
        return value.map(String);
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map(String);
            }
        } catch {
            // Plain comma-separated values are handled below.
        }

        return value.split(",").map((item) => item.trim()).filter(Boolean);
    }

    return [];
}

function normalizedValueSet(value) {
    return new Set(
        normalizeValues(value).map((item) => item.trim().toLowerCase())
    );
}

function setFieldValue(field, value) {
    if (!field || value === null || value === undefined) {
        return;
    }

    if (field.type === "checkbox" || field.type === "radio") {
        return;
    }

    field.value = value;
}

function populateField(name, value) {
    const fields = [...document.querySelectorAll(`[name="${CSS.escape(name)}"]`)];

    if (!fields.length) {
        return;
    }

    if (fields[0].type === "checkbox" || fields[0].type === "radio") {
        const selected = normalizedValueSet(value);
        fields.forEach((field) => {
            field.checked = selected.has(field.value.trim().toLowerCase());
        });
        return;
    }

    setFieldValue(fields[0], value);
}

function getProfileValue(profile, names) {
    return names.find((name) => profile[name] !== undefined)
        ? profile[names.find((name) => profile[name] !== undefined)]
        : undefined;
}

function populateProfile(profile) {
    const fieldAliases = {
        "full-name": ["full_name"],
        username: ["username"],
        phone: ["phone"],
        "date-of-birth": ["date_of_birth", "dob"],
        gender: ["gender"],
        city: ["city"],
        state: ["state"],
        country: ["country"],
        "other-cuisines": ["other_cuisines"],
        "signature-dishes": ["signature_dishes"],
        specialities: ["specialities", "cooking_specialities"],
        "min-price": ["min_price", "minimum_price"],
        "max-price": ["max_price", "maximum_price"],
        "ingredient-policy": ["ingredient_policy"],
        "additional-charges": ["additional_charges"],
        "booking-size": ["minimum_booking_size", "booking_size"],
        "booking-duration": ["minimum_booking_duration", "booking_duration"],
        experience: ["years_of_experience", "experience"],
        speciality: ["professional_speciality", "speciality"],
        languages: ["languages_spoken", "languages"],
        training: ["culinary_training", "training"],
        about: ["about", "about_yourself"],
        achievements: ["professional_achievements", "achievements"],
        "areas-served": ["areas_served"],
        "travel-distance": ["maximum_travel_distance", "travel_distance"],
        "max-guests": ["maximum_guests", "max_guests"],
        fssai: ["fssai_registration_number", "fssai"],
        qualification: ["professional_qualification", "qualification"],
        "portfolio-url": ["portfolio_url"]
    };

    Object.entries(fieldAliases).forEach(([fieldName, aliases]) => {
        const value = getProfileValue(profile, aliases);
        if (value !== undefined) {
            populateField(fieldName, value);
        }
    });

    [
        ["cuisine", ["cuisines", "cuisine"]],
        ["preference", ["food_preferences", "preferences"]],
        ["service", ["services"]],
        ["availability", ["availability"]],
        ["pricing-method", ["pricing_method"]]
    ].forEach(([fieldName, aliases]) => {
        const value = getProfileValue(profile, aliases);
        if (value !== undefined) {
            populateField(fieldName, value);
        }
    });

    const fullName = profile.full_name || "Chef";
    const username = profile.username || "chef";
    const initials = getInitials(fullName);
    byId("full-name").value = fullName;
    byId("username").value = username;
    byId("email").value = currentUser.email || "";
    byId("heroName").textContent = fullName;
    byId("heroUsername").firstChild.textContent = `@${username} `;
    byId("heroAvatar").textContent = initials;
    byId("topAvatar").textContent = initials;
    byId("chefId").textContent = profile.id || "Not available";
    byId("atcCode").textContent = profile.atc_code || "Not available";
    byId("joinedDate").textContent = formatDate(profile.created_at);
    byId("accountType").textContent = profile.account_type || "Professional";

    const verification = profile.verification_status || "Pending review";
    byId("verificationStatus").innerHTML =
        `<i class="fa-solid fa-clock"></i> ${escapeHtml(verification)}`;

    if (profile.bio || profile.about || profile.about_yourself) {
        byId("heroBio").textContent =
            profile.bio || profile.about || profile.about_yourself;
    }

    document.title = `My Profile | ${fullName}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* <!------- Stage 3: Supabase Session and Profile -------> */
async function createSupabaseClient() {
    if (!window.supabase?.createClient) {
        throw new Error("Supabase SDK failed to load.");
    }

    if (!window.CF_SUPABASE_URL || !window.CF_SUPABASE_KEY) {
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

async function loadProfile() {
    try {
        supabaseClient = await createSupabaseClient();
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        if (!sessionData.session) {
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const { data: userData, error: userError } =
            await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            await supabaseClient.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return;
        }

        currentUser = userData.user;

        const { data: profile, error: profileError } = await supabaseClient
            .from(PROFILE_TABLE)
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            throw new Error("No chef profile was found for this account.");
        }

        originalProfile = profile;
        populateProfile(profile);
        setStatus("Profile loaded");
    } catch (error) {
        console.error("Profile loading error:", error);
        setStatus("Unable to load profile", "error");
        byId("heroMessage").textContent =
            error.message || "Unable to load your profile.";
    }
}

/* <!------- Stage 4: Safe Update Path -------> */
function collectEditableChanges() {
    if (!originalProfile) {
        throw new Error("Profile is not ready yet.");
    }

    const changes = {};
    const fieldToColumn = {
        "date-of-birth": "date_of_birth",
        gender: "gender",
        city: "city",
        state: "state",
        country: "country",
        "other-cuisines": "other_cuisines",
        "signature-dishes": "signature_dishes",
        specialities: "specialities",
        "min-price": "min_price",
        "max-price": "max_price",
        "ingredient-policy": "ingredient_policy",
        "additional-charges": "additional_charges",
        "booking-size": "minimum_booking_size",
        "booking-duration": "minimum_booking_duration",
        experience: "years_of_experience",
        speciality: "professional_speciality",
        languages: "languages_spoken",
        training: "culinary_training",
        bio: "bio",
        about: "about",
        achievements: "professional_achievements",
        "areas-served": "areas_served",
        "travel-distance": "maximum_travel_distance",
        "max-guests": "maximum_guests",
        fssai: "fssai_registration_number",
        qualification: "professional_qualification"
    };

    Object.entries(fieldToColumn).forEach(([fieldName, column]) => {
        if (!(column in originalProfile)) {
            return;
        }

        const field = byId(fieldName);
        if (field && field.value !== String(originalProfile[column] ?? "")) {
            changes[column] = field.value.trim();
        }
    });

    ["cuisine", "preference", "service", "availability", "pricing-method"].forEach((name) => {
        const fields = [...document.querySelectorAll(`[name="${name}"]`)];
        const column = {
            cuisine: "cuisines",
            preference: "food_preferences",
            service: "services",
            availability: "availability",
            "pricing-method": "pricing_method"
        }[name];

        if (column in originalProfile && fields.some((field) => field.checked)) {
            changes[column] = fields
                .filter((field) => field.checked)
                .map((field) => field.value);
        }
    });

    return changes;
}

async function saveProfile(event) {
    event.preventDefault();

    if (!supabaseClient || !currentUser || !originalProfile) {
        throw new Error("Profile is not ready yet.");
    }

    const changes = collectEditableChanges();
    delete changes.username;
    delete changes.email;

    if (!Object.keys(changes).length) {
        setStatus("No changes to save");
        return;
    }

    const { data: updatedProfile, error } = await supabaseClient
        .from(PROFILE_TABLE)
        .update(changes)
        .eq("id", currentUser.id)
        .select("*")
        .single();

    if (error) {
        throw error;
    }

    originalProfile = updatedProfile;
    populateProfile(updatedProfile);
    setStatus("Profile updated");
}

if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
        saveProfile(event).catch((error) => {
            console.error("Profile update error:", error);
            setStatus("Unable to update profile", "error");
            byId("heroMessage").textContent =
                error.message || "Your profile could not be updated.";
        });
    });
}

loadProfile();
