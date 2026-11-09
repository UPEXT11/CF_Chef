/* <!------- Stage 1: Supabase Setup -------> */

const supabaseClient = window.supabase.createClient(
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


/* <!------- Stage 2: Page State -------> */

const bookingList = document.getElementById("bookingList");
const messageBox = document.getElementById("message");

let currentUser = null;
let bookings = [];
let activeFilter = "all";
let pendingAction = null;

const syncFailures = new Set();
const syncingIds = new Set();


/* <!------- Stage 3: Helpers -------> */

function showMessage(message, isError = false) {
    messageBox.textContent = message;
    messageBox.classList.toggle("error", isError);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatDate(date) {
    if (!date) return "Not provided";

    return new Date(date + "T00:00:00").toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );
}

function formatTime(time) {
    if (!time) return "Not provided";

    const [hours, minutes] = time.split(":");
    const date = new Date();

    date.setHours(Number(hours), Number(minutes), 0);

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function openModal(id) {
    document.getElementById(id).classList.add("show");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("show");
}


/* <!------- Stage 4: Authentication -------> */

async function checkAuthentication() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error || !data.user) {
        window.location.replace("./login.html");
        return false;
    }

    currentUser = data.user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("chef_profiles")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();

    if (profileError || !profile) {
        showMessage("Chef profile could not be verified.", true);
        return false;
    }

    return true;
}


/* <!------- Stage 5: Customer Booking Synchronization -------> */

async function syncCustomerBookingStatus(booking) {
    if (!booking.customer_booking_id) {
        throw new Error("Customer booking ID is missing.");
    }

    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session?.access_token) {
        throw new Error(
            "Your chef session has expired. Please sign in again."
        );
    }

    const apiUrl = window.CHEF_FEAST_API_URL?.replace(/\/+$/, "");

    if (!apiUrl) {
        throw new Error("Chef Feast API URL is not configured.");
    }

    const response = await fetch(
        `${apiUrl}/api/bookings/chef-status`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.session.access_token}`
            },
            body: JSON.stringify({
                customer_booking_id: booking.customer_booking_id,
                status: booking.status
            })
        }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success !== true) {
        throw new Error(
            result.message ||
            `Customer synchronization failed (${response.status}).`
        );
    }

    return result;
}


/* <!------- Stage 6: Load Bookings -------> */

async function loadBookings() {
    bookingList.innerHTML =
        '<div class="loading">Loading bookings...</div>';

    showMessage("");

    const { data, error } = await supabaseClient
        .from("chef_bookings")
        .select("*")
        .eq("chef_id", currentUser.id)
        .order("created_at", { ascending: false });

    if (error) {
        bookingList.innerHTML =
            '<div class="empty-state">Unable to load bookings.</div>';

        showMessage(error.message, true);
        return false;
    }

    bookings = data || [];

    updateStatistics();
    renderBookings();

    return true;
}


/* <!------- Stage 7: Statistics -------> */

function updateStatistics() {
    document.getElementById("totalCount").textContent =
        bookings.length;

    document.getElementById("pendingCount").textContent =
        bookings.filter(b => b.status === "pending").length;

    document.getElementById("acceptedCount").textContent =
        bookings.filter(b => b.status === "accepted").length;

    document.getElementById("completedCount").textContent =
        bookings.filter(b => b.status === "completed").length;
}


/* <!------- Stage 8: Render Booking Cards -------> */

function renderBookings() {
    const search = document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const filtered = bookings.filter(booking => {
        const matchesStatus =
            activeFilter === "all" ||
            booking.status === activeFilter;

        const matchesSearch =
            (booking.customer_name || "").toLowerCase().includes(search) ||
            (booking.id || "").toLowerCase().includes(search);

        return matchesStatus && matchesSearch;
    });

    if (!filtered.length) {
        bookingList.innerHTML =
            '<div class="empty-state">No bookings found.</div>';
        return;
    }

    bookingList.innerHTML = filtered.map(booking => {
        let actions = `
            <button class="action-btn"
                data-action="details"
                data-id="${escapeHTML(booking.id)}">
                View details
            </button>
        `;

        if (booking.status === "pending") {
            actions += `
                <button class="action-btn accept-btn"
                    data-action="accept"
                    data-id="${escapeHTML(booking.id)}">
                    Accept
                </button>

                <button class="action-btn reject-btn"
                    data-action="reject"
                    data-id="${escapeHTML(booking.id)}">
                    Reject
                </button>
            `;
        }

        if (booking.status === "accepted") {
            actions += `
                <button class="action-btn accept-btn"
                    data-action="complete"
                    data-id="${escapeHTML(booking.id)}">
                    Mark completed
                </button>

                <button class="action-btn reject-btn"
                    data-action="cancel"
                    data-id="${escapeHTML(booking.id)}">
                    Cancel booking
                </button>
            `;
        }

        if (syncFailures.has(booking.id)) {
            actions += `
                <button class="action-btn"
                    data-action="retry-sync"
                    data-id="${escapeHTML(booking.id)}"
                    ${syncingIds.has(booking.id) ? "disabled" : ""}>
                    ${syncingIds.has(booking.id)
                        ? "Retrying..."
                        : "Retry customer sync"}
                </button>
            `;
        }

        return `
            <article class="booking-card">

                <div class="booking-top">
                    <div>
                        <h3>${escapeHTML(booking.customer_name)}</h3>
                        <div class="booking-id">
                            Booking ID: ${escapeHTML(booking.id)}
                        </div>
                    </div>

                    <span class="status ${escapeHTML(booking.status)}">
                        ${escapeHTML(booking.status)}
                    </span>
                </div>

                <div class="booking-meta">
                    <span>📅 ${escapeHTML(formatDate(booking.service_date))}</span>
                    <span>◷ ${escapeHTML(formatTime(booking.service_time))}</span>
                    <span>👥 ${escapeHTML(booking.guest_count)} guests</span>
                </div>

                <div class="booking-actions">
                    ${actions}
                </div>

            </article>
        `;
    }).join("");
}


/* <!------- Stage 9: Booking Details -------> */

function showBookingDetails(id) {
    const booking = bookings.find(item => item.id === id);

    if (!booking) return;

    const fields = [
        ["Customer", booking.customer_name],
        ["Phone", booking.customer_phone],
        ["Date", formatDate(booking.service_date)],
        ["Time", formatTime(booking.service_time)],
        ["Guests", booking.guest_count],
        ["Address", booking.service_address],
        ["Requirements", booking.requirements || "None provided"],
        ["Status", booking.status],
        ["Chef response", booking.response_note || "No response"],
        ["Cancellation reason", booking.cancellation_reason || "None"]
    ];

    document.getElementById("bookingDetails").innerHTML =
        fields.map(([label, value]) => `
            <div class="detail-row">
                <span>${escapeHTML(label)}</span>
                <strong>${escapeHTML(value)}</strong>
            </div>
        `).join("");

    openModal("detailsModal");
}


/* <!------- Stage 10: Prepare Booking Actions -------> */

function prepareAction(action, id) {
    if (action === "retry-sync") {
        retryCustomerSync(id);
        return;
    }

    const booking = bookings.find(item => item.id === id);

    if (!booking) return;

    if (action === "details") {
        showBookingDetails(id);
        return;
    }

    if (action === "cancel") {
        pendingAction = { action, id };

        document.getElementById("cancellationReason").value = "";

        openModal("cancelModal");
        return;
    }

    const settings = {
        accept: {
            title: "Accept booking",
            description: "Confirm that you want to accept this request.",
            status: "accepted"
        },
        reject: {
            title: "Reject booking",
            description: "Confirm that you want to reject this request.",
            status: "rejected"
        },
        complete: {
            title: "Complete booking",
            description: "Mark this booking as completed.",
            status: "completed"
        }
    };

    const selected = settings[action];

    if (!selected) return;

    pendingAction = {
        action,
        id,
        status: selected.status
    };

    document.getElementById("responseTitle").textContent =
        selected.title;

    document.getElementById("responseDescription").textContent =
        selected.description;

    const responseNote = document.getElementById("responseNote");
    responseNote.value = "";
    responseNote.required = action === "reject";
    responseNote.setCustomValidity("");
    document.querySelector('label[for="responseNote"]').textContent =
        action === "reject" ? "Note (required to reject)" : "Note (optional)";

    openModal("responseModal");
}


/* <!------- Stage 11: Update Booking Status -------> */

async function updateBooking(id, status, note = "", reason = "") {
    const booking = bookings.find(item => item.id === id);

    if (!booking) return;

    const allowedTransitions = {
        pending: ["accepted", "rejected"],
        accepted: ["completed", "cancelled"]
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
        showMessage("This booking action is not allowed.", true);
        return;
    }

    const updateData = {
        status
    };

    if (status === "accepted" || status === "rejected") {
        updateData.response_note = note.trim() || null;
    }

    if (status === "cancelled") {
        updateData.cancellation_reason = reason.trim();
    }

    showMessage("Saving booking update...");

    const { data, error } = await supabaseClient
        .from("chef_bookings")
        .update(updateData)
        .eq("id", id)
        .eq("chef_id", currentUser.id)
        .eq("status", booking.status)
        .select("id")
        .maybeSingle();

    if (error) {
        showMessage(error.message, true);
        return;
    }

    if (!data) {
        showMessage(
            "Booking was not updated. It may have changed already.",
            true
        );
        await loadBookings();
        return;
    }

    closeModal("responseModal");
    closeModal("cancelModal");

    // The local CF Chef update succeeded.
    // Now synchronize the matching Chef Feast booking.

    const updatedBooking = {
        ...booking,
        ...updateData
    };

    await loadBookings();

    try {
        await syncCustomerBookingStatus(updatedBooking);

        syncFailures.delete(id);

        showMessage("Booking updated and customer status synchronized.");
    } catch (syncError) {
        syncFailures.add(id);

        renderBookings();

        showMessage(
            `Chef booking updated, but customer sync failed: ${syncError.message}`,
            true
        );
    }
}


/* <!------- Stage 12: Retry Customer Synchronization -------> */

async function retryCustomerSync(id) {
    if (syncingIds.has(id)) return;

    const booking = bookings.find(item => item.id === id);

    if (!booking) {
        showMessage("Booking could not be found. Refresh and try again.", true);
        return;
    }

    syncingIds.add(id);
    renderBookings();

    showMessage("Retrying customer booking synchronization...");

    try {
        await syncCustomerBookingStatus(booking);

        syncFailures.delete(id);

        showMessage("Customer booking status synchronized successfully.");
    } catch (error) {
        showMessage(
            `Synchronization still failed: ${error.message}`,
            true
        );
    } finally {
        syncingIds.delete(id);
        renderBookings();
    }
}


/* <!------- Stage 13: Event Listeners -------> */

bookingList.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    prepareAction(
        button.dataset.action,
        button.dataset.id
    );
});

document.getElementById("filters").addEventListener("click", event => {
    const button = event.target.closest("[data-status]");

    if (!button) return;

    activeFilter = button.dataset.status;

    document.querySelectorAll(".filter").forEach(filter => {
        filter.classList.toggle("active", filter === button);
    });

    renderBookings();
});

document.getElementById("searchInput").addEventListener(
    "input",
    renderBookings
);

document.getElementById("refreshBtn").addEventListener(
    "click",
    loadBookings
);

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        closeModal(button.dataset.close);
    });
});

document.getElementById("responseCancel").addEventListener(
    "click",
    () => closeModal("responseModal")
);

document.getElementById("responseNote").addEventListener("input", (event) => {
    event.currentTarget.setCustomValidity("");
});

document.getElementById("responseConfirm").addEventListener(
    "click",
    async () => {
        if (!pendingAction) return;

        const responseNote = document.getElementById("responseNote");
        const note = responseNote.value.trim();

        if (pendingAction.action === "reject" && !note) {
            responseNote.setCustomValidity("Please enter a note before rejecting this booking.");
            responseNote.reportValidity();
            return;
        }

        await updateBooking(
            pendingAction.id,
            pendingAction.status,
            note
        );

        pendingAction = null;
    }
);

document.getElementById("cancelBack").addEventListener(
    "click",
    () => closeModal("cancelModal")
);

document.getElementById("cancelConfirm").addEventListener(
    "click",
    async () => {
        if (!pendingAction) return;

        const reason = document.getElementById(
            "cancellationReason"
        ).value.trim();

        if (!reason) {
            showMessage("Please enter a cancellation reason.", true);
            return;
        }

        await updateBooking(
            pendingAction.id,
            "cancelled",
            "",
            reason
        );

        pendingAction = null;
    }
);

/* <!------- Stage 14: Modal Background -------> */

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.classList.remove("show");
        }
    });
});


/* <!------- Stage 15: Initialize Page -------> */

async function initializeBookings() {
    const authenticated = await checkAuthentication();

    if (!authenticated) return;

    await loadBookings();
}

initializeBookings();