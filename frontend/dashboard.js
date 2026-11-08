/* =====================================================
   CF CHEFS — OPERATIONS DASHBOARD
===================================================== */

/* <!------- Stage 1: Configuration -------> */
const LOGIN_PAGE = "./login.html";
const PROFILE_TABLE = "chef_profiles";
const BOOKING_TABLE = "bookings";
let supabaseClient;

/* <!------- Stage 2: DOM and Helpers -------> */
const byId = (id) => document.getElementById(id);
const toast = byId("toast");

function showToast(message, type = "success") {
    toast.textContent = message;
    toast.className = `toast show${type === "error" ? " error" : ""}`;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.className = "toast";
    }, 3500);
}

function initials(name) {
    return String(name || "Chef").trim().split(/\s+/).slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase()).join("") || "C";
}

function formatDate(value) {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
    });
}

function setText(id, value, fallback = "Not available") {
    const element = byId(id);
    if (element) element.textContent = value || fallback;
}

function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && String(value).trim().length > 0;
}

/* <!------- Stage 3: Profile Completion -------> */
function calculateCompletion(profile) {
    const checks = [
        profile.full_name, profile.username, profile.phone,
        profile.city, profile.country, profile.about || profile.bio,
        profile.specialities || profile.professional_speciality,
        profile.cuisines, profile.services, profile.availability
    ];
    return Math.round((checks.filter(hasValue).length / checks.length) * 100);
}

function updateProfileHealth(profile) {
    const completion = calculateCompletion(profile);
    setText("profileStrength", `${completion}%`);
    setText("completionValue", `${completion}%`);
    setText("profileStrengthText", completion >= 80 ? "Strong chef profile" : "Complete your chef story");
    setText("completionTitle", completion >= 80 ? "Looking great" : "A few details away");
    setText("completionDescription", completion >= 80
        ? "Guests can now get a clear feel for your craft."
        : "Add the details that make your service stand out.");
    byId("completionBar").style.width = `${completion}%`;

    const storyReady = hasValue(profile.about || profile.bio) && hasValue(profile.specialities || profile.professional_speciality);
    const servicesReady = hasValue(profile.services) && hasValue(profile.availability);
    [["healthStory", storyReady], ["healthServices", servicesReady]].forEach(([id, ready]) => {
        const row = byId(id);
        row.querySelector("i").className = ready ? "fa-solid fa-check" : "fa-solid fa-circle";
        row.querySelector("i").style.color = ready ? "var(--green)" : "";
        row.querySelector("b").textContent = ready ? "Ready" : "To do";
        row.querySelector("b").style.color = ready ? "var(--green)" : "";
    });
}

/* <!------- Stage 4: Supabase Data -------> */
async function createClient() {
    if (!window.supabase?.createClient) throw new Error("Supabase SDK failed to load.");
    if (!window.CF_SUPABASE_URL || !window.CF_SUPABASE_KEY) throw new Error("Supabase configuration is missing.");
    return window.supabase.createClient(window.CF_SUPABASE_URL, window.CF_SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
}

async function loadBookings(userId) {
    const result = await supabaseClient.from(BOOKING_TABLE).select("id,status").eq("chef_id", userId);
    if (result.error) {
        return;
    }

    const bookings = result.data || [];
    const pending = bookings.filter((booking) => ["pending", "requested", "new"].includes(String(booking.status || "").toLowerCase())).length;
    setText("totalBookings", bookings.length, "0");
    setText("pendingBookings", pending, "0");
    setText("bookingNavCount", bookings.length, "0");
    setText("activitySummary", bookings.length ? `${bookings.length} request${bookings.length === 1 ? "" : "s"} recorded` : "No requests yet");
}

async function initializeDashboard() {
    try {
        supabaseClient = await createClient();
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

        const user = userData.user;
        const { data: profile, error: profileError } = await supabaseClient
            .from(PROFILE_TABLE).select("*").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error("Your chef profile could not be found.");

        const name = profile.full_name || "Chef";
        const firstName = name.trim().split(/\s+/)[0];
        const avatar = initials(name);
        setText("welcomeName", firstName);
        setText("profileName", name);
        setText("profileUsername", `@${profile.username || "chef"}`);
        setText("profileEmail", user.email, "Not available");
        setText("profilePhone", profile.phone, "Not provided");
        setText("profileId", profile.id);
        setText("profileJoined", formatDate(profile.created_at));
        byId("topAvatar").textContent = avatar;
        byId("profileAvatar").textContent = avatar;
        byId("connectionText").textContent = "Connected";
        updateProfileHealth(profile);
        document.title = `Dashboard | ${name}`;
        await loadBookings(user.id);
    } catch (error) {
        console.error("Dashboard loading error:", error);
        byId("connectionText").textContent = "Connection issue";
        showToast(error.message || "Unable to load dashboard.", "error");
        setText("welcomeName", "Chef");
    }
}

byId("currentYear").textContent = new Date().getFullYear();
initializeDashboard();
