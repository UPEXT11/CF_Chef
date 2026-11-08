/* =====================================================
   CF CHEFS — ACCOUNT CENTER
===================================================== */

/* <!------- Stage 1: Configuration -------> */
const LOGIN_PAGE = "./login.html";
const PROFILE_TABLE = "chef_profiles";
const DELETION_TABLE = "account_deletion_requests";
let supabaseClient;
let currentUser;
let profile;

/* <!------- Stage 2: UI Helpers -------> */
const byId = (id) => document.getElementById(id);
const statusBox = byId("accountStatus");

function setStatus(message, type = "") {
    statusBox.className = `account-status${type ? ` ${type}` : ""}`;
    statusBox.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : type === "success" ? "fa-circle-check" : "fa-circle-info"}"></i><span>${escapeHtml(message)}</span>`;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[character]));
}

/* <!------- Stage 3: Authentication and Data -------> */
async function initializeAccountCenter() {
    try {
        if (!window.supabase?.createClient || !window.CF_SUPABASE_URL || !window.CF_SUPABASE_KEY) {
            throw new Error("Supabase configuration is missing.");
        }
        supabaseClient = window.supabase.createClient(window.CF_SUPABASE_URL, window.CF_SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData.session) {
            window.location.replace(LOGIN_PAGE);
            return;
        }
        const { data: userData, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !userData.user) {
            window.location.replace(LOGIN_PAGE);
            return;
        }
        currentUser = userData.user;
        const result = await supabaseClient.from(PROFILE_TABLE).select("*").eq("id", currentUser.id).maybeSingle();
        if (result.error) throw result.error;
        profile = result.data || {};
        setStatus("Account verified. Your actions are ready.");
    } catch (error) {
        console.error("Account center loading error:", error);
        setStatus(error.message || "Unable to load account center.", "error");
        [byId("signOutButton"), byId("exportButton"), byId("deleteButton")].forEach((button) => {
            button.disabled = true;
        });
    }
}

/* <!------- Stage 4: Account Actions -------> */
async function signOut() {
    const button = byId("signOutButton");
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing out...';
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        window.location.replace(LOGIN_PAGE);
    } catch (error) {
        console.error("Sign out error:", error);
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> Sign Out';
        setStatus("Unable to sign out. Please try again.", "error");
    }
}

function exportData() {
    if (!currentUser) {
        setStatus("Your account is not ready yet.", "error");
        return;
    }
    const exportPayload = {
        exported_at: new Date().toISOString(),
        account: { id: currentUser.id, email: currentUser.email || null, created_at: currentUser.created_at || null },
        chef_profile: profile
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cf-chefs-account-${currentUser.id}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus("Your data export has been downloaded.", "success");
}

async function requestDeletion() {
    if (!currentUser) {
        setStatus("Your account is not ready yet.", "error");
        return;
    }
    const confirmed = window.confirm("Request account deletion? Your account will not be deleted immediately. Our team will review the request.");
    if (!confirmed) return;
    const button = byId("deleteButton");
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending request...';
    try {
        const { error } = await supabaseClient.from(DELETION_TABLE).insert({
            user_id: currentUser.id,
            email: currentUser.email || null,
            reason: "Requested from Account Center",
            status: "pending"
        });
        if (error) throw error;
        setStatus("Deletion request sent. Support will contact you before any permanent action.", "success");
    } catch (error) {
        console.error("Deletion request error:", error);
        setStatus("Deletion requests are not available yet. Please contact support.", "error");
        button.disabled = false;
        button.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Request Deletion';
    }
}

byId("signOutButton").addEventListener("click", signOut);
byId("exportButton").addEventListener("click", exportData);
byId("deleteButton").addEventListener("click", requestDeletion);
byId("currentYear").textContent = new Date().getFullYear();
initializeAccountCenter();
