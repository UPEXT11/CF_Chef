/* <!------- Stage 1: Mobile Tab Bar -------> */
(function createMobileTabBar() {
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    const appPages = new Set(["dashboard.html", "bookings.html", "profile.html", "edit.html", "account.html"]);
    const dashboardUrl = "./dashboard.html";
    const tabs = [
        { file: "dashboard.html", label: "Home", icon: "fa-house" },
        { file: "bookings.html", label: "Bookings", icon: "fa-calendar-check" },
        { file: "profile.html", label: "Profile", icon: "fa-user" },
        { file: "account.html", label: "Account", icon: "fa-user-shield" }
    ];

    const tabBar = document.createElement("nav");
    tabBar.className = "mobile-tab-bar";
    tabBar.setAttribute("aria-label", "Mobile navigation");

    tabs.forEach((tab) => {
        const link = document.createElement("a");
        link.className = "mobile-tab-link";
        link.href = `./${tab.file}`;
        link.innerHTML = `<i class="fa-solid ${tab.icon}" aria-hidden="true"></i><span>${tab.label}</span>`;

        if (currentPage === tab.file) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }

        tabBar.appendChild(link);
    });

    document.body.appendChild(tabBar);

    function isAppPage(url) {
        return appPages.has(url.pathname.split("/").pop() || "dashboard.html");
    }

    function navigateWithinApp(event) {
        const link = event.currentTarget;
        const target = new URL(link.href, window.location.href);

        if (target.origin !== window.location.origin || !isAppPage(target)) return;

        event.preventDefault();
        window.history.replaceState({ appPage: "dashboard" }, "", dashboardUrl);
        window.history.pushState({ appPage: target.pathname }, "", `${target.pathname}${target.search}${target.hash}`);
        window.location.reload();
    }

    document.querySelectorAll("a[href]").forEach((link) => {
        link.addEventListener("click", navigateWithinApp);
    });

    window.addEventListener("popstate", () => {
        window.location.replace(dashboardUrl);
    });
}());
