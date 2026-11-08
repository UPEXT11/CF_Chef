/* =====================================================
   CF CHEFS — EDIT PROFILE
===================================================== */

/* <!------- Stage 1: Configuration -------> */
const LOGIN_PAGE = "./login.html";
const PROFILE_TABLE = "chef_profiles";
const form = document.getElementById("editProfileForm");
const saveButton = document.getElementById("saveButton");
const formMessage = document.getElementById("formMessage");
const pageStatus = document.getElementById("pageStatus");
let supabaseClient;
let currentUser;
let originalProfile;

/* <!------- Stage 2: UI Helpers -------> */
const byId = (id) => document.getElementById(id);
function setMessage(message, error = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("error-message", error);
    pageStatus.textContent = error ? "Action failed" : message;
}
function initials(name) {
    return String(name || "Chef").trim().split(/\s+/).slice(0, 2)
        .map((word) => word[0]?.toUpperCase() || "").join("") || "C";
}
function values(value) {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
        // A comma-separated value is also supported for older rows.
    }
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function sameValues(left, right) {
    const normalize = (items) => items.map((item) => String(item).trim().toLowerCase()).sort();
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
function setValue(id, value) {
    const field = byId(id);
    if (field && value !== null && value !== undefined) field.value = value;
}
function setChoice(name, value) {
    const selected = new Set(values(value).map((item) => item.trim().toLowerCase()));
    document.querySelectorAll(`[name="${name}"]`).forEach((field) => {
        field.checked = selected.has(field.value.trim().toLowerCase());
    });
}
function getValue(profile, names) {
    const name = names.find((key) => profile[key] !== undefined);
    return name ? profile[name] : undefined;
}

/* <!------- Stage 3: Profile Mapping -------> */
const fieldMap = {
    "full-name": ["full_name"], username: ["username"], phone: ["phone"],
    "date-of-birth": ["date_of_birth", "dob"], gender: ["gender"], city: ["city"],
    state: ["state"], country: ["country"], "other-cuisines": ["other_cuisines"],
    "signature-dishes": ["signature_dishes"], specialities: ["specialities", "cooking_specialities"],
    "min-price": ["min_price", "minimum_price"], "max-price": ["max_price", "maximum_price"],
    "ingredient-policy": ["ingredient_policy"], "additional-charges": ["additional_charges"],
    "booking-size": ["minimum_booking_size", "booking_size"],
    "booking-duration": ["minimum_booking_duration", "booking_duration"],
    experience: ["years_of_experience", "experience"], speciality: ["professional_speciality", "speciality"],
    languages: ["languages_spoken", "languages"], training: ["culinary_training", "training"],
    bio: ["bio"], about: ["about", "about_yourself"], achievements: ["professional_achievements", "achievements"],
    "areas-served": ["areas_served"], "travel-distance": ["maximum_travel_distance", "travel_distance"],
    "max-guests": ["maximum_guests", "max_guests"], fssai: ["fssai_registration_number", "fssai"],
    qualification: ["professional_qualification", "qualification"], "portfolio-url": ["portfolio_url"]
};
const immutableFields = new Set(["full-name", "email", "phone"]);

function populate(profile) {
    Object.entries(fieldMap).forEach(([id, names]) => {
        const value = getValue(profile, names);
        if (value !== undefined) setValue(id, value);
    });
    setValue("email", currentUser.email || "");
    setChoice("cuisine", getValue(profile, ["cuisines", "cuisine"]));
    setChoice("preference", getValue(profile, ["food_preferences", "preferences"]));
    setChoice("service", getValue(profile, ["services"]));
    setChoice("availability", getValue(profile, ["availability"]));
    setChoice("pricing-method", getValue(profile, ["pricing_method"]));
    byId("topAvatar").textContent = initials(profile.full_name);
}

/* <!------- Stage 4: Supabase Loading -------> */
async function getClient() {
    if (!window.supabase?.createClient || !window.CF_SUPABASE_URL || !window.CF_SUPABASE_KEY) {
        throw new Error("Supabase configuration is missing.");
    }
    return window.supabase.createClient(window.CF_SUPABASE_URL, window.CF_SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
}
async function loadProfile() {
    try {
        supabaseClient = await getClient();
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
            window.location.replace(LOGIN_PAGE);
            return;
        }
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData.user) {
            await supabaseClient.auth.signOut();
            window.location.replace(LOGIN_PAGE);
            return;
        }
        currentUser = userData.user;
        const { data: profile, error } = await supabaseClient.from(PROFILE_TABLE)
            .select("*").eq("id", currentUser.id).maybeSingle();
        if (error) throw error;
        if (!profile) throw new Error("No chef profile was found for this account.");
        originalProfile = profile;
        immutableFields.forEach((id) => {
            const field = byId(id);
            if (field) {
                field.readOnly = true;
                field.setAttribute("aria-readonly", "true");
            }
        });
        populate(profile);
        setMessage("Ready to edit");
    } catch (error) {
        console.error("Edit profile loading error:", error);
        setMessage(error.message || "Unable to load your profile.", true);
        saveButton.disabled = true;
    }
}

/* <!------- Stage 5: Safe Payload and Update -------> */
function collectChanges() {
    const changes = {};
    Object.entries(fieldMap).forEach(([id, columns]) => {
        if (immutableFields.has(id)) return;
        const column = columns.find((candidate) => candidate in originalProfile);
        if (!column) return;
        const field = byId(id);
        if (!field) return;
        const next = field.value.trim();
        if (next !== String(originalProfile[column] ?? "")) changes[column] = next || null;
    });
    ["cuisine", "preference", "service", "availability", "pricing-method"].forEach((name) => {
        const column = { cuisine: "cuisines", preference: "food_preferences", service: "services", availability: "availability", "pricing-method": "pricing_method" }[name];
        if (!(column in originalProfile)) return;
        const next = [...document.querySelectorAll(`[name="${name}"]:checked`)].map((field) => field.value);
        const previous = values(originalProfile[column]);
        if (!sameValues(next, previous)) changes[column] = next;
    });
    delete changes.id;
    delete changes.email;
    delete changes.created_at;
    delete changes.updated_at;
    return changes;
}
function validateChanges(changes) {
    const fullName = String(originalProfile.full_name ?? "").trim();
    if (fullName.length < 2 || fullName.length > 80) return "Full name must contain 2–80 characters.";
    const phone = changes.phone ?? originalProfile.phone;
    if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(String(phone))) return "Enter a valid phone number.";
    const min = Number(changes.min_price ?? originalProfile.min_price);
    const max = Number(changes.max_price ?? originalProfile.max_price);
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) return "Maximum price must be greater than minimum price.";
    return "";
}
async function saveProfile(event) {
    event.preventDefault();
    if (!supabaseClient || !currentUser || !originalProfile) {
        setMessage("Profile is not ready yet.", true);
        return;
    }
    const changes = collectChanges();
    const validationError = validateChanges(changes);
    if (validationError) {
        setMessage(validationError, true);
        return;
    }
    if (!Object.keys(changes).length) {
        setMessage("No changes to save");
        return;
    }
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    setMessage("Saving your profile...");
    try {
        const { data: updated, error } = await supabaseClient.from(PROFILE_TABLE)
            .update(changes).eq("id", currentUser.id).select("*").single();
        if (error) throw error;
        originalProfile = updated;
        populate(updated);
        setMessage("Profile saved successfully");
        window.setTimeout(() => window.location.replace("./profile.html"), 700);
    } catch (error) {
        console.error("Profile update error:", error);
        setMessage(error.message || "Unable to update your profile.", true);
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="fa-solid fa-check"></i> Save Changes';
    }
}
form.addEventListener("submit", saveProfile);
loadProfile();
